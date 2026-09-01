import { useState, useEffect, useRef, useCallback } from 'react'
import {
  db, dbRef, dbGet, dbSet, dbUpdate, dbOnValue, dbOnDisconnect, genCode,
} from '../lib/firebase'
import { PLAY_ROUND, pickRoundQs } from '../data'

export default function MltGame({ onBack }) {
  const [screen, setScreen] = useState('lobby') // lobby | wait | game | results
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState('create') // create | join

  // state
  const [isHost, setIsHost] = useState(false)
  const [roomRef, setRoomRef] = useState(null)
  const [myCode, setMyCode] = useState('')
  const [hostName, setHostName] = useState('')
  const [joinerName, setJoinerName] = useState('')
  const [waitMsg, setWaitMsg] = useState('')
  const [joinReady, setJoinReady] = useState(false)
  const [startBtnText, setStartBtnText] = useState('ابدأ اللعبة! 🎉')

  // game state
  const [allQs, setAllQs] = useState([])
  const [totalQ, setTotalQ] = useState(PLAY_ROUND)
  const [curQ, setCurQ] = useState(0)
  const [question, setQuestion] = useState(null)
  const [lbl1, setLbl1] = useState('')
  const [lbl2, setLbl2] = useState('')
  const [hasVoted, setHasVoted] = useState(false)
  const [vStat, setVStat] = useState('')
  const [vReveal, setVReveal] = useState(null)
  const [showNext, setShowNext] = useState(false)
  const [lastQ, setLastQ] = useState(false)
  const [scores, setScores] = useState({ h: 0, j: 0 })

  // results
  const [resData, setResData] = useState(null)
  const [resDetails, setResDetails] = useState([])
  const [resTitles, setResTitles] = useState([])

  const listenersRef = useRef([])
  const stateRef = useRef({ hasVoted: false, curQ: 0, prevQ: -1 })
  const isHostRef = useRef(false)
  isHostRef.current = isHost
  const scoresRef = useRef({ h: 0, j: 0 })
  scoresRef.current = scores

  const clean = useCallback(() => {
    listenersRef.current.forEach((r) => r && r.off && r.off())
    listenersRef.current = []
  }, [])

  useEffect(() => {
    return () => clean()
  }, [clean])

  const listen = useCallback((path, cb) => {
    const r = dbRef(db, path)
    const off = dbOnValue(r, cb)
    listenersRef.current.push({ off })
  }, [])

  const showQ = useCallback(
    (idx) => {
      if (idx >= allQs.length) return
      const q = allQs[idx]
      setQuestion(q)
      setCurQ(idx)
      setHasVoted(false)
      stateRef.current = { ...stateRef.current, curQ: idx, hasVoted: false }
      setVStat('')
      setVReveal(null)
      setShowNext(false)
      setLastQ(idx + 1 >= totalQ)
    },
    [allQs, totalQ]
  )

  const checkBothVoted = useCallback(() => {
    dbGet(roomRef).then((snap) => {
      const room = snap.val()
      const hv = room.hv, jv = room.jv
      if (hv === null || jv === null || hv === undefined || jv === undefined) return
      setHasVoted(true)
      setShowNext(true)
      const nameOf = (v) => (v === 1 ? room.hostName : v === 2 ? room.joinerName : null)
      let reveal
      if (hv !== 'skip' && jv !== 'skip' && hv === jv) {
        if (hv === 3) reveal = { type: 'agree', html: 'اتفقتم! 💕<br><strong>محدش فينا</strong> هو الأجوبة' }
        else reveal = { type: 'agree', html: 'أنتما اتفقتوا! 💕<br><strong>' + nameOf(hv) + '</strong> هو(ي) الأكتر واحد' }
      } else if (hv === 'skip' && jv === 'skip') {
        reveal = { type: 'disagree', html: 'الاتنين خطّتوا! 😅' }
      } else if (hv === 'skip' || jv === 'skip') {
        const sk = hv === 'skip' ? room.hostName : room.joinerName
        const vt = hv === 'skip' ? room.joinerName : room.hostName
        reveal = { type: 'disagree', html: sk + ' خطّط... ' + vt + ' بصّت! 🤔' }
      } else if (hv === 3 || jv === 3) {
        const who = hv === 3 ? room.hostName : room.joinerName
        const whom = hv === 3 ? room.joinerName : room.hostName
        const n = nameOf(hv === 3 ? jv : hv)
        reveal = { type: 'disagree', html: 'مختلفين! 🤔<br>' + who + ' قال محدش فينا... ' + whom + ' اختار(ت) ' + n }
      } else if (hv !== jv) {
        reveal = { type: 'disagree', html: 'مختلفين! 🤔<br>' + room.hostName + ' اختار(ت) ' + nameOf(hv) + '... ' + room.joinerName + ' اختار(ت) ' + nameOf(jv) }
      }
      setVReveal(reveal)
    })
  }, [roomRef])

  const initGame = useCallback(() => {
    dbGet(roomRef).then((snap) => {
      const room = snap.val()
      setAllQs(JSON.parse(room.questions || '[]'))
      setTotalQ(room.totalQ || PLAY_ROUND)
      setHostName(room.hostName)
      setJoinerName(room.joinerName)
      setLbl1(room.hostName)
      setLbl2(room.joinerName)
      setScreen('game')
      listen('rooms/' + myCode + '/scores', (s) => {
        if (s.val()) {
          const v = s.val()
          setScores({ h: v.h || 0, j: v.j || 0 })
        }
      })
      listen('rooms/' + myCode + '/hv', (s) => {
        if (s.val() !== null) checkBothVoted()
      })
      listen('rooms/' + myCode + '/jv', (s) => {
        if (s.val() !== null) checkBothVoted()
      })
    })
  }, [roomRef, myCode, listen, checkBothVoted])

  const handleStatus = useCallback(
    (st) => {
      if (st === 'playing') initGame()
      else if (st === 'finished') showResults()
      else if (st === 'waiting') onReplay()
    },
    [initGame]
  )

  const createRoom = () => {
    const n = name.trim()
    if (!n) return
    let code = genCode()
    const r = dbRef(db, 'rooms/' + code)
    dbGet(r).then((snap) => {
      if (snap.exists()) {
        code = genCode()
        return dbSet(dbRef(db, 'rooms/' + code), buildRoom(code, n))
      }
      return dbSet(r, buildRoom(code, n))
    }).then(() => {
      setRoomRef(dbRef(db, 'rooms/' + code))
      setMyCode(code)
      setIsHost(true)
      setWaitMsg('شارك الكود اللي فوق مع شريحتك عشان يدخل')
      setScreen('wait')
      const rr = dbRef(db, 'rooms/' + code)
      dbOnDisconnect(rr).update({ status: 'disconnected' })
      listen('rooms/' + code + '/joinerName', (s) => {
        const nn = s.val()
        if (nn) {
          setJoinerName(nn)
          setJoinReady(true)
          setStartBtnText('ابدأ اللعب مع ' + nn + '! 🎉')
        }
      })
      listen('rooms/' + code + '/status', (s) => handleStatus(s.val()))
    })
  }

  const buildRoom = (code, hostName) => ({
    code,
    hostName,
    joinerName: '',
    status: 'waiting',
    currentQ: 0,
    questions: JSON.stringify(pickRoundQs()),
    scores: { h: 0, j: 0 },
    totalQ: PLAY_ROUND,
    hv: null,
    jv: null,
    history: {},
  })

  const joinRoom = () => {
    const n = name.trim()
    const c = code.trim()
    if (!n || c.length !== 6) return
    const r = dbRef(db, 'rooms/' + c)
    dbGet(r).then((snap) => {
      if (!snap.exists()) throw new Error('notfound')
      const room = snap.val()
      if (room.joinerName && room.joinerName !== '') throw new Error('full')
      return dbUpdate(r, { joinerName: n, status: 'ready' })
    }).then(() => {
      setRoomRef(r)
      setMyCode(c)
      setIsHost(false)
      setWaitMsg('مستنيين صاحب الغرفة يبدأ اللعبة...')
      setScreen('wait')
      dbOnDisconnect(r).update({ status: 'disconnected' })
      listen('rooms/' + c + '/status', (s) => handleStatus(s.val()))
    }).catch((e) => {
      setWaitMsg(e.message === 'notfound' ? 'الغرفة مش موجودة!' : e.message === 'full' ? 'الغرفة مليانة!' : 'حصل خطأ')
    })
  }

  const startGame = () => {
    if (!isHostRef.current) return
    dbGet(roomRef).then((snap) => {
      const room = snap.val()
      setAllQs(JSON.parse(room.questions || '[]'))
      setTotalQ(room.totalQ || PLAY_ROUND)
      return dbUpdate(roomRef, { status: 'playing', currentQ: 0, scores: { h: 0, j: 0 }, history: {} })
    })
  }

  const castVote = (v) => {
    if (stateRef.current.hasVoted) return
    stateRef.current.hasVoted = true
    setHasVoted(true)
    dbUpdate(roomRef, { [isHost ? 'hv' : 'jv']: v })
    setVStat('تم التصويت! مستنيين الشريك... ⏳')
  }

  const skipQ = () => {
    if (stateRef.current.hasVoted) return
    stateRef.current.hasVoted = true
    setHasVoted(true)
    dbUpdate(roomRef, { [isHost ? 'hv' : 'jv']: 'skip' })
    setVStat('تخطيت السؤال! ⏭️')
  }

  const nextQ = () => {
    dbGet(roomRef).then((snap) => {
      const room = snap.val()
      const nq = room.currentQ + 1
      const h = room.history || {}
      h[curQ] = { hv: room.hv, jv: room.jv }
      if (nq >= totalQ) {
        return dbUpdate(roomRef, { currentQ: nq, history: h, scores, status: 'finished', hv: null, jv: null })
      }
      return dbUpdate(roomRef, { currentQ: nq, history: h, hv: null, jv: null })
    })
  }

  const showResults = () => {
    dbGet(roomRef).then((snap) => {
      const room = snap.val()
      const s = room.scores || { h: 0, j: 0 }
      const hN = room.hostName
      const jN = room.joinerName
      const qs = JSON.parse(room.questions || '[]')
      const history = room.history || {}
      setResData({ hN, jN, h: s.h, j: s.j })
      let msg = ''
      const diff = Math.abs(s.h - s.j)
      if (s.h === s.j) msg = '<strong>' + hN + '</strong> و<strong>' + jN + '</strong> متساويين تماماً! 💕 تعكسوا بعض!'
      else if (diff <= 3) msg = '<strong>' + hN + '</strong> و<strong>' + jN + '</strong> قريبين من بعض! 💞'
      else {
        const top = s.h > s.j ? hN : jN
        msg = '<strong>' + top + '</strong> عنده(ا) ' + Math.max(s.h, s.j) + ' تصويت! 🏆'
      }
      setResMsg(msg)
      const titles = []
      qs.forEach((q, i) => {
        const h = history[i]
        if (!h) return
        if (h.hv !== undefined && h.hv !== 'skip' && h.hv !== null && h.hv !== 3)
          titles.push({ name: hN, text: q.q, cls: 'hb' })
        if (h.jv !== undefined && h.jv !== 'skip' && h.jv !== null && h.jv !== 3 && h.hv !== h.jv)
          titles.push({ name: jN, text: q.q, cls: 'jb' })
      })
      setResTitles(titles)
      const details = []
      qs.forEach((q, i) => {
        const h = history[i]
        let b
        if (!h) b = { cls: 'skip', txt: '⏭️ لم يُلعَب' }
        else if (h.hv === 'skip' && h.jv === 'skip') b = { cls: 'skip', txt: '⏭️ تم التخطي' }
        else if (h.hv === 'skip' || h.jv === 'skip' || h.hv === undefined || h.jv === undefined) b = { cls: 'skip', txt: '⏭️ لم يُصوَّت بالكامل' }
        else if (h.hv === h.jv) b = { cls: 'both', txt: '🤝 ' + (h.hv === 3 ? 'محدش فينا' : h.hv === 1 ? hN : jN) }
        else b = { cls: 'diff', txt: (h.hv === 3 ? 'محدش فينا' : hN) + ' — ' + (h.jv === 3 ? 'محدش فينا' : jN) }
        details.push({ q: q.e + ' ' + q.q, ...b })
      })
      setResDetails(details)
      setScreen('results')
    })
  }
  const [resMsg, setResMsg] = useState('')

  const playAgain = () => {
    dbGet(roomRef).then((snap) => {
      const oldQs = JSON.parse(snap.val().questions || '[]')
      return dbUpdate(snap.ref, {
        status: 'waiting',
        questions: JSON.stringify(pickRoundQs(oldQs)),
        totalQ: PLAY_ROUND,
        currentQ: 0,
        history: {},
        scores: { h: 0, j: 0 },
        hv: null,
        jv: null,
      })
    })
  }

  const onReplay = () => {
    setScores({ h: 0, j: 0 })
    stateRef.current = { hasVoted: false, curQ: 0, prevQ: -1 }
    setCurQ(0)
    setJoinReady(isHostRef.current)
    setWaitMsg(isHostRef.current ? 'اضغط ابدأ لما تكونوا جاهزين' : 'مستنيين صاحب الغرفة يبدأ...')
    setScreen('wait')
  }

  const copyCode = () => {
    navigator.clipboard.writeText(myCode).then(() => setWaitMsg('✅ تم النسخ!'))
  }

  // ---------- RENDER ----------
  if (screen === 'lobby') {
    return (
      <div className="relative min-h-screen w-full max-w-md mx-auto px-5 py-10">
        <button onClick={onBack} className="text-white/50 text-sm mb-6">→ رجوع</button>
        <div className="text-center mb-8">
          <h1 className="shuruq-title text-4xl font-bold">مين أكتر واحد فينا؟</h1>
          <p className="text-white/50 text-sm mt-2">العب أونلاين مع شريحتك!</p>
        </div>
        <div className="rounded-3xl backdrop-blur-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <label className="block text-sm mb-1 text-white/70">اسمك أنت 💫</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: سارة"
              maxLength={20}
              className="w-full rounded-xl px-4 py-3 bg-white/10 border border-white/15 focus:border-rose-main outline-none"
            />
          </div>
          {mode === 'create' ? (
            <>
              <button onClick={createRoom} className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-main to-violet-deep font-extrabold">
                أنشئ غرفة جديدة 🎮
              </button>
              <div className="text-center text-white/40 text-sm">أو</div>
              <button onClick={() => setMode('join')} className="w-full py-3 rounded-xl border border-white/20 font-bold text-white/80">
                عندي كود — ادخل غرفة 🚀
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm mb-1 text-white/70">كود الغرفة 🔢</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="أدخل الكود"
                  maxLength={6}
                  style={{ letterSpacing: 4, textAlign: 'center', fontWeight: 700, fontSize: 18 }}
                  className="w-full rounded-xl px-4 py-3 bg-white/10 border border-white/15 focus:border-rose-main outline-none"
                />
              </div>
              <button onClick={joinRoom} className="w-full py-3 rounded-xl border border-white/20 font-bold text-white/80">
                ادخل الغرفة 🚀
              </button>
              <div className="text-center text-white/40 text-sm">أو</div>
              <button onClick={() => setMode('create')} className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-main to-violet-deep font-extrabold">
                أنشئ غرفة جديدة 🎮
              </button>
            </>
          )}
        </div>
        <div className="text-center text-white/30 text-xs mt-8">شروقتي ♡</div>
      </div>
    )
  }

  if (screen === 'wait') {
    return (
      <div className="relative min-h-screen w-full max-w-md mx-auto px-5 py-10">
        <div className="rounded-3xl backdrop-blur-xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="text-5xl mb-3">⏳</div>
          <h2 className="text-xl font-extrabold mb-4">{isHost ? 'في انتظار شريحتك...' : 'ادخلت الغرفة!'}</h2>
          <div className="rounded-2xl bg-white/10 border border-white/15 p-4 mb-3">
            <div className="text-white/50 text-xs mb-1">كود الغرفة</div>
            <div className="text-3xl font-extrabold tracking-[0.3em] text-gold-light">{myCode}</div>
          </div>
          <button onClick={copyCode} className="text-gold-light text-sm underline mb-3">📋 انسخ الكود</button>
          <p className="text-white/60 text-sm mt-2">{waitMsg}</p>
          <div className="flex justify-center gap-1.5 mt-4">
            {[0, 1, 2].map((d) => (
              <span key={d} className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: d * 0.15 + 's' }} />
            ))}
          </div>
          {isHost && (
            <div className="mt-6">
              {joinReady && (
                <p className="text-gold-light font-bold mb-3 text-sm">{joinerName || 'شريحتك'} دخلت الغرفة! 🎉</p>
              )}
              <button
                onClick={startGame}
                disabled={!joinReady}
                className={`w-full py-3 rounded-xl font-extrabold bg-gradient-to-r from-rose-main to-violet-deep ${!joinReady ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {startBtnText}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (screen === 'game') {
    return (
      <div className="relative min-h-screen w-full max-w-md mx-auto px-5 py-6">
        <div className="flex justify-between items-center mb-3 text-sm font-bold">
          <span className="bg-white/10 px-3 py-1.5 rounded-full">{(curQ ) + 1} / {totalQ}</span>
          <span className="bg-white/10 px-3 py-1.5 rounded-full">💛 {scores.h} - {scores.j}</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 mb-4 overflow-hidden">
          <div className="h-full transition-all duration-500 bg-gradient-to-r from-rose-main to-violet-soft" style={{ width: (curQ / totalQ * 100) + '%' }} />
        </div>

        <div className="rounded-3xl backdrop-blur-xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="text-5xl mb-2">{question?.e}</div>
          <div className="text-white/50 text-xs mb-3">السؤال {curQ + 1} من {totalQ}</div>
          <div className="text-lg font-bold leading-relaxed mb-5">{question?.q}</div>

          <div className="flex gap-3">
            <button
              disabled={hasVoted}
              onClick={() => castVote(1)}
              className={`flex-1 py-4 rounded-2xl border border-rose-main/40 text-rose-light font-bold transition ${hasVoted ? 'opacity-50' : 'hover:bg-rose-main/20'}`}
            >
              <span className="block text-2xl mb-1">🙋</span>
              {lbl1}
            </button>
            <button
              disabled={hasVoted}
              onClick={() => castVote(2)}
              className={`flex-1 py-4 rounded-2xl border border-violet-deep/40 text-violet-soft font-bold transition ${hasVoted ? 'opacity-50' : 'hover:bg-violet-deep/20'}`}
            >
              <span className="block text-2xl mb-1">🙋</span>
              {lbl2}
            </button>
          </div>
          <button
            disabled={hasVoted}
            onClick={() => castVote(3)}
            className={`w-full mt-3 py-3 rounded-2xl border border-gold-gold/40 text-gold-light font-bold text-sm transition ${hasVoted ? 'opacity-50' : 'hover:bg-gold-gold/15'}`}
          >
            <span className="text-lg">🚫</span> محدش فينا
          </button>

          {vStat && <div className="mt-4 text-white/60 text-sm">{vStat}</div>}

          {vReveal && (
            <div className={`mt-4 p-4 rounded-2xl text-sm font-bold leading-relaxed ${vReveal.type === 'agree' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}
              dangerouslySetInnerHTML={{ __html: vReveal.html }}
            />
          )}

          {!hasVoted && (
            <button onClick={skipQ} className="mt-4 text-white/40 text-sm">تخطي ⏭️</button>
          )}

          {(showNext && isHost) && (
            <div className="mt-5">
              <button onClick={nextQ} className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-main to-violet-deep font-extrabold">
                {lastQ ? 'عرض النتيجة 🏆' : 'السؤال التالي ←'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // results
  if (screen === 'results' && resData) {
    return (
      <div className="relative min-h-screen w-full max-w-md mx-auto px-5 py-10">
        <div className="rounded-3xl backdrop-blur-xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="shuruq-title text-3xl font-bold mb-4">شروقتي</div>
          <div className="text-5xl mb-2">🏆</div>
          <h2 className="text-xl font-extrabold mb-5">النتيجة النهائية!</h2>
          <div className="flex justify-center gap-4 mb-5">
            <div className="flex-1 rounded-2xl bg-rose-main/15 border border-rose-main/40 p-4">
              <div className="font-bold">{resData.hN}</div>
              <div className="text-3xl font-extrabold text-rose-light">{resData.h}</div>
              <div className="text-white/50 text-xs">تصويت</div>
            </div>
            <div className="flex-1 rounded-2xl bg-violet-deep/15 border border-violet-deep/40 p-4">
              <div className="font-bold">{resData.jN}</div>
              <div className="text-3xl font-extrabold text-violet-soft">{resData.j}</div>
              <div className="text-white/50 text-xs">تصويت</div>
            </div>
          </div>
          <div className="text-sm font-bold leading-relaxed mb-5" dangerouslySetInnerHTML={{ __html: resMsg }} />

          {resTitles.length > 0 && (
            <div className="mb-5 text-right">
              <h3 className="font-bold text-sm text-rose-light mb-2">ملخص الألقاب 🏅</h3>
              {resTitles.map((t, i) => (
                <div key={i} className={`text-xs mb-1 ${t.cls === 'hb' ? 'text-rose-light' : 'text-violet-soft'}`}>
                  {t.name}: {t.text.replace('مين أكتر واحد فينا', '')}
                </div>
              ))}
            </div>
          )}

          <div className="mb-5 text-right">
            <h3 className="font-bold text-sm text-white/70 mb-2">تفاصيل كل سؤال 📋</h3>
            {resDetails.map((d, i) => (
              <div key={i} className="flex justify-between items-center text-xs mb-1 border-b border-white/5 pb-1">
                <span className="text-white/70">{d.q}</span>
                <span className={d.cls === 'both' ? 'text-emerald-300' : d.cls === 'skip' ? 'text-white/40' : 'text-white/70'}>{d.txt}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={playAgain} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-main to-violet-deep font-extrabold">
              العب مرة ثانية 🔄
            </button>
            <button onClick={onBack} className="flex-1 py-3 rounded-xl border border-white/20 font-bold text-white/80">
              رجوع الرئيسية 🏠
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

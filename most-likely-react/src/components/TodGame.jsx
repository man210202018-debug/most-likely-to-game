import { useState, useEffect, useRef, useCallback } from 'react'
import {
  db, dbRef, dbGet, dbSet, dbUpdate, dbOnValue, dbOnDisconnect, genCode,
} from '../lib/firebase'
import { TOD_TRUTH, TOD_DARE, TOD_PENALTIES, todShuffle } from '../data'

export default function TodGame({ onBack }) {
  const [screen, setScreen] = useState('lobby') // lobby | wait | game | results
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState('create')

  const [isHost, setIsHost] = useState(false)
  const [myCode, setMyCode] = useState('')
  const [hostName, setHostName] = useState('')
  const [joinerName, setJoinerName] = useState('')
  const [waitMsg, setWaitMsg] = useState('')
  const [joinReady, setJoinReady] = useState(false)
  const [startBtnText, setStartBtnText] = useState('ابدأ اللعب مع ' + (joinerName || '') + '! 🎉')

  // game
  const [round, setRound] = useState(0)
  const [maxRounds, setMaxRounds] = useState(15)
  const [chooserIsHost, setChooserIsHost] = useState(true)
  const [phase, setPhase] = useState(1) // 1 choose, 2 answer, 3 penalty
  const [currentPick, setCurrentPick] = useState(null) // {choice,question,accepted,penalty,refusedBy}
  const [hostRefusals, setHostRefusals] = useState(0)
  const [joinerRefusals, setJoinerRefusals] = useState(0)
  const [results, setResults] = useState({})
  const [resData, setResData] = useState(null)

  const pool = useRef({ truth: todShuffle(TOD_TRUTH), dare: todShuffle(TOD_DARE), penalty: todShuffle(TOD_PENALTIES) })
  const listenersRef = useRef([])
  const isHostRef = useRef(false)
  isHostRef.current = isHost
  const roomRefRef = useRef(null)

  const clean = useCallback(() => {
    listenersRef.current.forEach((r) => r && r.off && r.off())
    listenersRef.current = []
  }, [])

  useEffect(() => () => clean(), [clean])

  const listen = useCallback((path, cb) => {
    const r = dbRef(db, path)
    const off = dbOnValue(r, cb)
    listenersRef.current.push({ off })
  }, [])

  const showTurn = useCallback(() => {
    setPhase(1)
    setCurrentPick(null)
  }, [])

  const showPick = useCallback(
    (p) => {
      setCurrentPick(p)
      if (p.accepted !== null && p.accepted !== undefined) {
        setPhase(3)
      } else {
        setPhase(2)
      }
    },
    []
  )

  const initGame = useCallback(() => {
    dbGet(roomRefRef.current).then((snap) => {
      const room = snap.val()
      setHostName(room.hostName)
      setJoinerName(room.joinerName)
      setRound(room.round || 1)
      setMaxRounds(room.maxRounds || 15)
      setChooserIsHost(room.chooserIsHost !== false)
      setHostRefusals(room.hostRefusals || 0)
      setJoinerRefusals(room.joinerRefusals || 0)
      setResults(room.results || {})
      setScreen('game')
      showTurn()
      listen('tod/' + myCode + '/round', (s) => {
        const r = s.val()
        if (r) {
          setRound(r)
          showTurn()
        }
      })
      listen('tod/' + myCode + '/chooserIsHost', (s) => {
        const v = s.val()
        if (v !== null && v !== undefined) setChooserIsHost(v)
      })
      listen('tod/' + myCode + '/currentPick', (s) => {
        const p = s.val()
        if (p && p.choice) showPick(p)
      })
      listen('tod/' + myCode + '/status', (s) => {
        if (s.val() === 'finished') showResults()
      })
    })
  }, [myCode, listen, showTurn, showPick])

  const handleStatus = useCallback(
    (st) => {
      if (st === 'playing') initGame()
      else if (st === 'finished') showResults()
    },
    [initGame]
  )

  const buildRoom = (code, hostName) => ({
    code,
    hostName,
    joinerName: '',
    status: 'waiting',
    round: 0,
    maxRounds: 15,
    chooserIsHost: true,
    hostRefusals: 0,
    joinerRefusals: 0,
    results: {},
    currentPick: null,
    truthPool: JSON.stringify(todShuffle(TOD_TRUTH)),
    darePool: JSON.stringify(todShuffle(TOD_DARE)),
    penaltyPool: JSON.stringify(todShuffle(TOD_PENALTIES)),
  })

  const startRoom = (buildFn) => {
    const n = name.trim()
    if (!n) return
    let code = genCode()
    const r = dbRef(db, 'tod/' + code)
    dbGet(r).then((snap) => {
      if (snap.exists()) {
        code = genCode()
        return dbSet(dbRef(db, 'tod/' + code), buildFn(code, n))
      }
      return dbSet(r, buildFn(code, n))
    }).then(() => {
      roomRefRef.current = dbRef(db, 'tod/' + code)
      setMyCode(code)
      setIsHost(true)
      setWaitMsg('شارك الكود اللي فوق مع شريحتك عشان يدخل')
      setScreen('wait')
      dbOnDisconnect(roomRefRef.current).update({ status: 'disconnected' })
      listen('tod/' + code + '/joinerName', (s) => {
        const nn = s.val()
        if (nn) {
          setJoinerName(nn)
          setJoinReady(true)
          setStartBtnText('ابدأ اللعب مع ' + nn + '! 🎉')
        }
      })
      listen('tod/' + code + '/status', (s) => handleStatus(s.val()))
    })
  }

  const createRoom = () => startRoom(buildRoom)

  const joinRoom = () => {
    const n = name.trim()
    const c = code.trim()
    if (!n || c.length !== 6) return
    const r = dbRef(db, 'tod/' + c)
    dbGet(r).then((snap) => {
      if (!snap.exists()) throw new Error('notfound')
      const room = snap.val()
      if (room.joinerName && room.joinerName !== '') throw new Error('full')
      return dbUpdate(r, { joinerName: n, status: 'ready' })
    }).then(() => {
      roomRefRef.current = r
      setMyCode(c)
      setIsHost(false)
      setWaitMsg('مستنيين صاحب الغرفة يبدأ اللعبة...')
      setScreen('wait')
      dbOnDisconnect(r).update({ status: 'disconnected' })
      listen('tod/' + c + '/status', (s) => handleStatus(s.val()))
    }).catch((e) => {
      setWaitMsg(e.message === 'notfound' ? 'الغرفة مش موجودة!' : e.message === 'full' ? 'الغرفة مليانة!' : 'حصل خطأ')
    })
  }

  const startGame = () => {
    if (!isHostRef.current) return
    dbGet(roomRefRef.current).then((snap) => {
      const room = snap.val()
      const p = JSON.parse(room.truthPool || '[]')
      const dp = JSON.parse(room.darePool || '[]')
      pool.current = { truth: p.length ? p : todShuffle(TOD_TRUTH), dare: dp.length ? dp : todShuffle(TOD_DARE), penalty: todShuffle(TOD_PENALTIES) }
      return dbUpdate(roomRefRef.current, {
        status: 'playing',
        round: 1,
        chooserIsHost: true,
        hostRefusals: 0,
        joinerRefusals: 0,
        results: {},
        currentPick: null,
      })
    })
  }

  const choose = (choice) => {
    const p = pool.current
    const poolArr = choice === 'truth' ? p.truth : p.dare
    const q = poolArr.length > 0 ? poolArr[Math.floor(Math.random() * poolArr.length)] : 'مفيش سؤال متبقى!'
    setCurrentPick({ choice, question: q, accepted: null })
    setPhase(2)
    dbUpdate(roomRefRef.current, { currentPick: { choice, question: q, accepted: null } })
  }

  const accept = () => {
    const p = currentPick || {}
    setResults((prev) => {
      const nr = { ...prev, [round]: { choice: p.choice, question: p.question, accepted: true, player: isHost ? 'h' : 'j' } }
      dbUpdate(roomRefRef.current, {
        currentPick: { choice: p.choice, question: p.question, accepted: true },
        results: nr,
      })
      return nr
    })
  }

  const refuse = () => {
    const p = currentPick || {}
    const penalty = pool.current.penalty.length > 0 ? pool.current.penalty[Math.floor(Math.random() * pool.current.penalty.length)] : "قول 'بحبك' 5 مرات! 💕"
    const refusing = isHost ? 'h' : 'j'
    const newH = isHost ? hostRefusals + 1 : hostRefusals
    const newJ = isHost ? joinerRefusals : joinerRefusals + 1
    setHostRefusals(newH)
    setJoinerRefusals(newJ)
    setResults((prev) => {
      const nr = { ...prev, [round]: { choice: p.choice, question: p.question, accepted: false, player: isHost ? 'h' : 'j' } }
      dbUpdate(roomRefRef.current, {
        currentPick: { choice: p.choice, question: p.question, accepted: false, penalty, refusedBy: refusing },
        hostRefusals: newH,
        joinerRefusals: newJ,
        results: nr,
      })
      return nr
    })
  }

  const nextTurn = () => {
    const nextRound = round + 1
    if (nextRound > maxRounds) {
      dbUpdate(roomRefRef.current, { status: 'finished' })
      return
    }
    const nextChooser = !chooserIsHost
    dbUpdate(roomRefRef.current, { round: nextRound, chooserIsHost: nextChooser, currentPick: null })
    setRound(nextRound)
    setChooserIsHost(nextChooser)
    showTurn()
  }

  const showResults = () => {
    dbGet(roomRefRef.current).then((snap) => {
      const room = snap.val()
      setResData({
        hN: room.hostName,
        jN: room.joinerName,
        hR: room.hostRefusals || 0,
        jR: room.joinerRefusals || 0,
      })
      setScreen('results')
    })
  }

  const todPlayAgain = () => {
    dbGet(roomRefRef.current).then((snap) => {
      const room = snap.val()
      const oldPick = room.currentPick || null
      const p = oldPick && JSON.parse(JSON.stringify(pool.current))
      return dbUpdate(snap.ref, {
        status: 'waiting',
        round: 0,
        chooserIsHost: true,
        hostRefusals: 0,
        joinerRefusals: 0,
        results: {},
        currentPick: null,
      })
    }).then(() => onReplay())
  }

  const onReplay = () => {
    setHostRefusals(0)
    setJoinerRefusals(0)
    setResults({})
    setRound(0)
    setCurrentPick(null)
    setJoinReady(isHostRef.current)
    setWaitMsg(isHostRef.current ? 'اضغط ابدأ لما تكونوا جاهزين' : 'مستنيين صاحب الغرفة يبدأ...')
    setScreen('wait')
  }

  const copyCode = () => {
    navigator.clipboard.writeText(myCode).then(() => setWaitMsg('✅ تم النسخ!'))
  }

  const isMyTurn = chooserIsHost === isHost
  const chooser = chooserIsHost ? hostName : joinerName
  const target = chooserIsHost ? joinerName : hostName
  const amTarget = (chooserIsHost && !isHost) || (!chooserIsHost && isHost)
  const totalRefusals = hostRefusals + joinerRefusals

  // ---------- RENDER ----------
  if (screen === 'lobby') {
    return (
      <div className="relative min-h-screen w-full max-w-md mx-auto px-5 py-10">
        <button onClick={onBack} className="text-white/50 text-sm mb-6">→ رجوع</button>
        <div className="text-center mb-8">
          <h1 className="shuruq-title text-4xl font-bold">صراحة ولا تحدي؟</h1>
          <p className="text-white/50 text-sm mt-2">أسئلة صراحة وتحديات واتعرفوا أكتر!</p>
        </div>
        <div className="rounded-3xl backdrop-blur-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <label className="block text-sm mb-1 text-white/70">اسمك أنت 💫</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: سارة"
              maxLength={20}
              className="w-full rounded-xl px-4 py-3 bg-white/10 border border-white/15 focus:border-gold-gold outline-none"
            />
          </div>
          {mode === 'create' ? (
            <>
              <button onClick={createRoom} className="w-full py-3 rounded-xl bg-gradient-to-r from-gold-gold to-rose-main font-extrabold">
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
                  className="w-full rounded-xl px-4 py-3 bg-white/10 border border-white/15 focus:border-gold-gold outline-none"
                />
              </div>
              <button onClick={joinRoom} className="w-full py-3 rounded-xl border border-white/20 font-bold text-white/80">
                ادخل الغرفة 🚀
              </button>
              <div className="text-center text-white/40 text-sm">أو</div>
              <button onClick={() => setMode('create')} className="w-full py-3 rounded-xl bg-gradient-to-r from-gold-gold to-rose-main font-extrabold">
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
                <p className="text-gold-light font-bold mb-3 text-sm">{joinerName} دخلت الغرفة! 🎉</p>
              )}
              <button
                onClick={startGame}
                disabled={!joinReady}
                className={`w-full py-3 rounded-xl font-extrabold bg-gradient-to-r from-gold-gold to-rose-main ${!joinReady ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          <span className="bg-white/10 px-3 py-1.5 rounded-full">الجولة {round} من {maxRounds}</span>
          <span className="bg-white/10 px-3 py-1.5 rounded-full">💛 {hostRefusals} - {joinerRefusals}</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 mb-4 overflow-hidden">
          <div className="h-full transition-all duration-500 bg-gradient-to-r from-gold-gold to-rose-main" style={{ width: ((round - 1) / maxRounds * 100) + '%' }} />
        </div>

        {/* PHASE 1: choose */}
        {phase === 1 && (
          <div className="rounded-3xl backdrop-blur-xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="text-white/60 text-sm mb-1">
              {isMyTurn ? 'دورك تختار!' : '⏳ في انتظار ' + chooser + ' يختار...'}
            </div>
            <div className="text-lg font-extrabold mb-5">
              {isMyTurn ? 'اختار: صراحة ولا تحدي؟' : chooser + ' يختار(ة)...'}
            </div>
            <div className="text-white/40 text-sm mb-5">الهدف: {target}</div>
            <div className="flex gap-3">
              <button
                disabled={!isMyTurn}
                onClick={() => choose('truth')}
                className={`flex-1 py-4 rounded-2xl border border-emerald-500/40 text-emerald-300 font-bold transition ${!isMyTurn ? 'opacity-40' : 'hover:bg-emerald-500/15'}`}
              >
                <span className="block text-2xl mb-1">🟢</span> صراحة
              </button>
              <button
                disabled={!isMyTurn}
                onClick={() => choose('dare')}
                className={`flex-1 py-4 rounded-2xl border border-red-500/40 text-red-300 font-bold transition ${!isMyTurn ? 'opacity-40' : 'hover:bg-red-500/15'}`}
              >
                <span className="block text-2xl mb-1">🔴</span> تحدي
              </button>
            </div>
          </div>
        )}

        {/* PHASE 2: answer */}
        {phase === 2 && currentPick && (
          <div className="rounded-3xl backdrop-blur-xl border border-white/10 bg-white/5 p-6 text-center">
            <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-5 ${currentPick.choice === 'truth' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
              {currentPick.choice === 'truth' ? 'صراحة 🟢' : 'تحدي 🔴'}
            </div>
            <div className="text-lg font-bold leading-relaxed mb-6">{currentPick.question}</div>
            {amTarget ? (
              <div className="flex gap-3">
                <button onClick={accept} className="flex-1 py-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold">
                  نجحت ✅
                </button>
                <button onClick={refuse} className="flex-1 py-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 font-bold">
                  رفضت 😱
                </button>
              </div>
            ) : (
              <div className="text-white/50 text-sm">⏳ مستنيين {target} يرد...</div>
            )}
          </div>
        )}

        {/* PHASE 3: penalty/result */}
        {phase === 3 && currentPick && (
          <div className="rounded-3xl backdrop-blur-xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="text-4xl mb-3">⭐</div>
            <div className="text-lg font-bold leading-relaxed mb-4 text-gold-light">
              {currentPick.accepted === true ? 'ما شاء الله! نجح(ت) بجدارة! 🎉' : currentPick.penalty}
            </div>
            <button onClick={nextTurn} className="w-full py-3 rounded-xl bg-gradient-to-r from-gold-gold to-rose-main font-extrabold">
              الجولة التالية ←
            </button>
          </div>
        )}
      </div>
    )
  }

  if (screen === 'results' && resData) {
    return (
      <div className="relative min-h-screen w-full max-w-md mx-auto px-5 py-10">
        <div className="rounded-3xl backdrop-blur-xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="shuruq-title text-3xl font-bold mb-4">شروقتي</div>
          <div className="text-5xl mb-2">🎭</div>
          <h2 className="text-xl font-extrabold mb-5">النتيجة النهائية!</h2>
          <div className="flex justify-center gap-4 mb-5">
            <div className="flex-1 rounded-2xl bg-rose-main/15 border border-rose-main/40 p-4">
              <div className="font-bold">{resData.hN}</div>
              <div className="text-3xl font-extrabold text-rose-light">{resData.hR}</div>
              <div className="text-white/50 text-xs">مرات رفض</div>
            </div>
            <div className="flex-1 rounded-2xl bg-violet-deep/15 border border-violet-deep/40 p-4">
              <div className="font-bold">{resData.jN}</div>
              <div className="text-3xl font-extrabold text-violet-soft">{resData.jR}</div>
              <div className="text-white/50 text-xs">مرات رفض</div>
            </div>
          </div>
          <div className="text-sm font-bold leading-relaxed mb-5">
            {resData.hR === resData.jR
              ? resData.hN + ' و' + resData.jN + ' شجاعين! 💪 محدش رفض! 🎉'
              : resData.hR === 0
              ? resData.hN + ' شجاع(ة) جداً! 🏆'
              : resData.jR === 0
              ? resData.jN + ' شجاع(ة) جداً! 🏆'
              : (resData.hR < resData.jR ? resData.hN : resData.jN) + ' أشجع! 💪'}
          </div>
          <div className="flex gap-3">
            <button onClick={todPlayAgain} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-gold-gold to-rose-main font-extrabold">
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

import MLT_QUESTIONS from './qs.json'
import TOD_TRUTH from './tod_truth.json'
import TOD_DARE from './tod_dare.json'
import TOD_PENALTIES from './tod_penalties.json'

export const PLAY_ROUND = 15

function shuffle(a) {
  const s = [...a]
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  return s
}

export function pickRoundQs(exclude = []) {
  let pool = MLT_QUESTIONS
  if (exclude && exclude.length) {
    const ex = new Set(exclude.map((q) => q.q))
    pool = MLT_QUESTIONS.filter((q) => !ex.has(q.q))
    if (pool.length < PLAY_ROUND) pool = MLT_QUESTIONS
  }
  return shuffle(pool).slice(0, PLAY_ROUND)
}

export function todShuffle(a) {
  const s = [...a]
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  return s
}

export { MLT_QUESTIONS, TOD_TRUTH, TOD_DARE, TOD_PENALTIES }

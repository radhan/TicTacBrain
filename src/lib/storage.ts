import type { TimerSetting } from './types'
import { TIMER_OPTIONS } from './types'

/** Tout ce qui est retenu sur l'appareil (localStorage). */
export interface SaveData {
  /** Meilleure série par mode de jeu et par chrono : `${pool}|${timer}` → série. */
  best: Record<string, number>
  /** Dernier affichage de chaque question : id → n° d'affichage (compteur `tick`). */
  seen: Record<string, number>
  tick: number
  stats: { answered: number; correct: number; bestEver: number; runs: number }
  timer: TimerSetting
}

const KEY = 'tictacbrain:v1'
const MAX_SEEN = 5000

const empty = (): SaveData => ({
  best: {},
  seen: {},
  tick: 0,
  stats: { answered: 0, correct: 0, bestEver: 0, runs: 0 },
  timer: 0,
})

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as Partial<SaveData>
    const base = empty()
    return {
      best: parsed.best ?? base.best,
      seen: parsed.seen ?? base.seen,
      tick: parsed.tick ?? base.tick,
      stats: { ...base.stats, ...parsed.stats },
      timer: TIMER_OPTIONS.includes(parsed.timer as TimerSetting) ? (parsed.timer as TimerSetting) : 0,
    }
  } catch {
    return empty()
  }
}

let data: SaveData = load()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Stockage indisponible (navigation privée, quota…) : on continue en mémoire.
  }
}

const bestKey = (pool: string, timer: TimerSetting) => `${pool}|${timer}`

export const save = {
  get: (): Readonly<SaveData> => data,

  best: (pool: string, timer: TimerSetting) => data.best[bestKey(pool, timer)] ?? 0,

  /** Meilleure série d'un thème tous modes confondus (pour la carte d'accueil). */
  bestForTheme(themeId: string) {
    let best = 0
    for (const [key, value] of Object.entries(data.best)) {
      const pool = key.split('|')[0]
      if (pool === themeId || pool.startsWith(`${themeId}/`)) best = Math.max(best, value)
    }
    return best
  },

  setTimer(timer: TimerSetting) {
    data.timer = timer
    persist()
  },

  markSeen(id: string) {
    data.tick += 1
    data.seen[id] = data.tick
    const ids = Object.keys(data.seen)
    if (ids.length > MAX_SEEN) {
      ids.sort((a, b) => data.seen[a] - data.seen[b])
      for (const old of ids.slice(0, ids.length - MAX_SEEN)) delete data.seen[old]
    }
    persist()
  },

  /** Enregistre une réponse et met à jour les records. */
  recordAnswer(pool: string, timer: TimerSetting, correct: boolean, streak: number) {
    data.stats.answered += 1
    if (correct) {
      data.stats.correct += 1
      data.stats.bestEver = Math.max(data.stats.bestEver, streak)
      const key = bestKey(pool, timer)
      data.best[key] = Math.max(data.best[key] ?? 0, streak)
    } else {
      data.stats.runs += 1
    }
    persist()
  },

  reset() {
    data = { ...empty(), timer: data.timer }
    persist()
  },
}

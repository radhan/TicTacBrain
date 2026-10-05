import type { TimerSetting } from './types'
import { TIMER_OPTIONS } from './types'

/**
 * Partie en cours d'un mode, pour la reprendre après un retour arrière, un
 * rechargement ou l'app tuée en arrière-plan (une série peut viser 150/150).
 */
export interface SavedRun {
  pool: string
  timer: TimerSetting
  /** Questions déjà posées dans la partie (dans l'ordre). */
  asked: string[]
  streak: number
  /** Question affichée, avec l'ordre de ses choix. */
  qId: string
  choices: string[]
  num: number
  phase: 'question' | 'correct'
  picked: string | null
  /** Échéance absolue du chrono (ms) : recharger la page ne rend pas de temps. */
  deadline: number | null
  /** Record du mode au début de la partie (pour célébrer un nouveau record après une reprise). */
  bestBefore?: number
  updatedAt: number
}

/** Tout ce qui est retenu sur l'appareil (localStorage). */
export interface SaveData {
  /** Meilleure série par mode de jeu et par chrono : `${pool}|${timer}` → série. */
  best: Record<string, number>
  /** Dernier affichage de chaque question : id → n° d'affichage (compteur `tick`). */
  seen: Record<string, number>
  tick: number
  stats: { answered: number; correct: number; bestEver: number; runs: number }
  /** Modes terminés sans aucune faute (toutes les questions du mode d'affilée). */
  perfect: Record<string, true>
  /** Parties en cours, une par mode et par chrono (`${pool}|${timer}`). */
  runs: Record<string, SavedRun>
  timer: TimerSetting
}

const KEY = 'tictacbrain:v1'
const MAX_SEEN = 5000

const empty = (): SaveData => ({
  best: {},
  seen: {},
  tick: 0,
  stats: { answered: 0, correct: 0, bestEver: 0, runs: 0 },
  perfect: {},
  runs: {},
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
      perfect: parsed.perfect ?? base.perfect,
      runs: parsed.runs ?? base.runs,
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

  /** Meilleure série d'un mode, tous chronos confondus. */
  bestAnyTimer(pool: string) {
    let best = 0
    for (const [key, value] of Object.entries(data.best)) if (key.split('|')[0] === pool) best = Math.max(best, value)
    return best
  },

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

  /** Sans-faute : toutes les questions du mode ont été réussies d'affilée. */
  recordPerfect(pool: string) {
    data.stats.runs += 1
    data.perfect[pool] = true
    persist()
  },

  isPerfect: (pool: string) => data.perfect[pool] === true,

  getRun: (pool: string, timer: TimerSetting): SavedRun | null => data.runs[bestKey(pool, timer)] ?? null,

  setRun(run: SavedRun) {
    data.runs[bestKey(run.pool, run.timer)] = run
    persist()
  },

  clearRun(pool: string, timer: TimerSetting) {
    if (!(bestKey(pool, timer) in data.runs)) return
    delete data.runs[bestKey(pool, timer)]
    persist()
  },

  /** Partie en cours d'un mode, quel que soit le chrono (la plus récente). */
  getRunAny(pool: string): SavedRun | null {
    const runs = Object.values(data.runs).filter((r) => r.pool === pool && r.streak > 0)
    return runs.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
  },

  /** Partie en cours la plus récente avec au moins une bonne réponse (carte « Reprendre »). */
  latestRun(): SavedRun | null {
    const runs = Object.values(data.runs).filter((r) => r.streak > 0)
    return runs.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null
  },

  reset() {
    data = { ...empty(), timer: data.timer }
    persist()
  },
}

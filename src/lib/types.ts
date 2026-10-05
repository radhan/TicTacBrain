/** Une question telle que servie par data/q/*.json (générée depuis questions/). */
export interface Question {
  id: string
  question: string
  answer: string
  wrong: string[]
  explanation: string
  difficulty: 1 | 2 | 3
  source?: string
}

export interface SubthemeInfo {
  id: string
  name: string
  icon: string
  description: string
  count: number
  file: string
}

export interface ThemeInfo {
  id: string
  name: string
  icon: string
  description: string
  color: string
  count: number
  subthemes: SubthemeInfo[]
}

export interface Catalog {
  version: string
  total: number
  themes: ThemeInfo[]
}

/** Question enrichie de son origine (utile en mode « tout le thème » / « tout mélanger »). */
export interface PoolQuestion extends Question {
  themeId: string
  subthemeId: string
}

/** Temps par question en secondes, 0 = illimité. */
export type TimerSetting = 0 | 10 | 30 | 60

export const TIMER_OPTIONS: TimerSetting[] = [0, 10, 30, 60]

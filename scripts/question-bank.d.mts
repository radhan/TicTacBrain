// Types de scripts/question-bank.mjs (utilisés par vite.config.ts et les tests).

export interface BankQuestion {
  id: string
  question: string
  answer: string
  wrong: string[]
  explanation: string
  difficulty: 1 | 2 | 3
  source?: string
}

export interface BankSubtheme {
  id: string
  name: string
  icon: string
  description: string
  order?: number
  questions: BankQuestion[]
}

export interface BankTheme {
  id: string
  name: string
  icon: string
  description: string
  color: string
  order?: number
  subthemes: BankSubtheme[]
}

export function questionId(themeId: string, subId: string, text: string): string

export function loadQuestionBank(dir?: string): {
  themes: BankTheme[]
  errors: string[]
  warnings: string[]
}

export function buildDataFiles(themes: BankTheme[]): Map<string, string>

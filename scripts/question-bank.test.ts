import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildDataFiles, loadQuestionBank, questionId } from './question-bank.mjs'

const dirs: string[] = []

/** Crée un dossier questions/ temporaire : { 'theme/_theme.json': {...}, 'theme/sub.json': {...} } */
function bank(files: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), 'ttb-'))
  dirs.push(dir)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path.split('/')[0]), { recursive: true })
    writeFileSync(join(dir, path), typeof content === 'string' ? content : JSON.stringify(content))
  }
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const theme = { name: 'Dev', icon: '💻' }
const question = (overrides: Record<string, unknown> = {}) => ({
  question: 'Que signifie CPU ?',
  answer: 'Central Processing Unit',
  wrong: ['Computer Personal Unit', 'Central Program Utility', 'Core Power Unit'],
  explanation: 'Le processeur exécute les instructions.',
  ...overrides,
})

describe('loadQuestionBank', () => {
  it('charge une banque valide', () => {
    const dir = bank({
      'dev/_theme.json': { ...theme, order: 1 },
      'dev/hardware.json': { name: 'Matériel', icon: '🖥️', questions: [question(), question({ question: 'Que signifie RAM ?', difficulty: 1 })] },
    })
    const { themes, errors } = loadQuestionBank(dir)
    expect(errors).toEqual([])
    expect(themes).toHaveLength(1)
    expect(themes[0].subthemes[0].questions).toHaveLength(2)
    expect(themes[0].subthemes[0].questions[0]).toMatchObject({
      id: questionId('dev', 'hardware', 'Que signifie CPU ?'),
      difficulty: 2,
    })
  })

  it('refuse une bonne réponse présente dans les mauvaises', () => {
    const dir = bank({
      'dev/_theme.json': theme,
      'dev/hw.json': { name: 'HW', icon: '🖥️', questions: [question({ wrong: [' Central  Processing Unit', 'X'] })] },
    })
    const { errors } = loadQuestionBank(dir)
    expect(errors.join('\n')).toMatch(/apparaît aussi dans « wrong »/)
  })

  it('respecte la casse des réponses (utile pour le code)', () => {
    const dir = bank({
      'dev/_theme.json': theme,
      'dev/hw.json': { name: 'HW', icon: '🖥️', questions: [question({ answer: '`java`', wrong: ['`JAVA`', '`Java`'] })] },
    })
    expect(loadQuestionBank(dir).errors).toEqual([])
  })

  it('signale les clés inconnues (fautes de frappe)', () => {
    const dir = bank({
      'dev/_theme.json': theme,
      'dev/hw.json': { name: 'HW', icon: '🖥️', questions: [{ ...question(), explication: 'oups' }] },
    })
    expect(loadQuestionBank(dir).errors.join('\n')).toMatch(/clé inconnue « explication »/)
  })

  it('exige au moins une mauvaise réponse et une explication', () => {
    const { explanation: _, ...noExplanation } = question()
    const dir = bank({
      'dev/_theme.json': theme,
      'dev/hw.json': { name: 'HW', icon: '🖥️', questions: [question({ wrong: [] }), noExplanation] },
    })
    const errors = loadQuestionBank(dir).errors.join('\n')
    expect(errors).toMatch(/question 1 : « wrong » doit contenir entre 1 et 5/)
    expect(errors).toMatch(/question 2 : champ « explanation » manquant/)
  })

  it('détecte les doublons dans un fichier', () => {
    const dir = bank({
      'dev/_theme.json': theme,
      'dev/hw.json': { name: 'HW', icon: '🖥️', questions: [question(), question({ question: '  que signifie  CPU ? ' })] },
    })
    expect(loadQuestionBank(dir).errors.join('\n')).toMatch(/question en double/)
  })

  it('signale un JSON invalide et un _theme.json manquant', () => {
    const dir = bank({
      'dev/_theme.json': theme,
      'dev/hw.json': '{ "name": "HW", ',
      'sport/fitness.json': { name: 'Fitness', icon: '🏋️', questions: [question()] },
    })
    const errors = loadQuestionBank(dir).errors.join('\n')
    expect(errors).toMatch(/hw\.json : JSON invalide/)
    expect(errors).toMatch(/sport\/_theme\.json : fichier manquant/)
  })

  it('refuse les noms de fichiers invalides et l’id réservé « all »', () => {
    const dir = bank({
      'all/_theme.json': theme,
      'dev/_theme.json': theme,
      'dev/Mon Fichier.json': { name: 'HW', icon: '🖥️', questions: [question()] },
    })
    const errors = loadQuestionBank(dir).errors.join('\n')
    expect(errors).toMatch(/all : nom de dossier invalide/)
    expect(errors).toMatch(/Mon Fichier\.json : nom de fichier invalide/)
  })
})

describe('buildDataFiles', () => {
  it('génère un catalogue et un fichier par sous-thème', () => {
    const dir = bank({
      'dev/_theme.json': theme,
      'dev/hw.json': { name: 'HW', icon: '🖥️', questions: [question()] },
      'dev/sw.json': { name: 'SW', icon: '📦', order: -1, questions: [question({ question: 'Que signifie OS ?' })] },
    })
    const files = buildDataFiles(loadQuestionBank(dir).themes)
    const catalog = JSON.parse(files.get('data/catalog.json')!)
    expect(catalog.total).toBe(2)
    expect(catalog.themes[0].subthemes.map((s: { id: string }) => s.id)).toEqual(['sw', 'hw'])
    for (const sub of catalog.themes[0].subthemes) {
      expect(sub.file).toMatch(/^data\/q\/dev\.\w+\.[0-9a-f]{8}\.json$/)
      expect(JSON.parse(files.get(sub.file)!)).toHaveLength(1)
    }
  })
})

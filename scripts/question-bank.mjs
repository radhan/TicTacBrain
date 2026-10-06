// Charge et valide la banque de questions (dossier questions/).
//
//   questions/<theme>/_theme.json        → métadonnées du thème
//   questions/<theme>/<sous-theme>.json  → métadonnées + questions du sous-thème
//
// Utilisé par le plugin Vite (dev + build) et par `npm run validate` (CI).
// Les limites (longueurs, nombre de mauvaises réponses…) sont lues depuis les
// JSON Schema de schemas/ pour rester synchronisées avec l'aide de l'éditeur.

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const THEME_SCHEMA = readJson(join(ROOT, 'schemas/theme.schema.json'))
const SUB_SCHEMA = readJson(join(ROOT, 'schemas/subtheme.schema.json'))
const Q_SCHEMA = SUB_SCHEMA.definitions.question

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** Les choix sont mélangés : une explication ne peut pas parler de « la dernière proposition ». */
const POSITIONAL_RE = /respectivement|(premi[eè]re|deuxi[eè]me|derni[eè]re) (proposition|réponse)|ci-dessus|\b(option|réponse|choix) [A-F]\b(?!['’])/i
const RESERVED_IDS = new Set(['all'])

/** Normalise un énoncé (détection de doublons, identifiant). */
const norm = (s) => s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
/** Normalise une réponse, en gardant la casse : `java` et `JAVA` sont deux réponses distinctes. */
const normAnswer = (s) => s.normalize('NFKC').trim().replace(/\s+/g, ' ')

/** Identifiant stable d'une question : thème/sous-thème/hash de l'énoncé. */
export const questionId = (themeId, subId, text) =>
  `${themeId}/${subId}/${createHash('sha1').update(norm(text)).digest('hex').slice(0, 10)}`

function checkString(errors, where, key, value, spec, required) {
  if (value === undefined) {
    if (required) errors.push(`${where} : champ « ${key} » manquant`)
    return
  }
  if (typeof value !== 'string') {
    errors.push(`${where} : « ${key} » doit être une chaîne de caractères`)
    return
  }
  const len = value.trim().length
  if (spec.minLength && len < spec.minLength)
    errors.push(`${where} : « ${key} » trop court (min ${spec.minLength} caractères)`)
  if (spec.maxLength && value.length > spec.maxLength)
    errors.push(`${where} : « ${key} » trop long (${value.length} > ${spec.maxLength} caractères)`)
  if (spec.pattern && !new RegExp(spec.pattern).test(value))
    errors.push(`${where} : « ${key} » a un format invalide (attendu : ${spec.pattern})`)
}

function checkKeys(errors, where, obj, schema) {
  const allowed = Object.keys(schema.properties)
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.push(`${where} : clé inconnue « ${key} » (clés possibles : ${allowed.filter((k) => k !== '$schema').join(', ')})`)
    }
  }
}

function checkMeta(errors, where, meta, schema) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    errors.push(`${where} : le fichier doit contenir un objet JSON`)
    return false
  }
  checkKeys(errors, where, meta, schema)
  for (const key of ['name', 'icon', 'description', 'color']) {
    if (schema.properties[key]) {
      checkString(errors, where, key, meta[key], schema.properties[key], schema.required.includes(key))
    }
  }
  if (meta.order !== undefined && !Number.isInteger(meta.order))
    errors.push(`${where} : « order » doit être un entier`)
  return true
}

function checkQuestion(errors, where, q) {
  if (!q || typeof q !== 'object' || Array.isArray(q)) {
    errors.push(`${where} : une question doit être un objet`)
    return false
  }
  const before = errors.length
  checkKeys(errors, where, q, Q_SCHEMA)
  const P = Q_SCHEMA.properties
  for (const key of ['question', 'answer', 'explanation', 'source']) {
    checkString(errors, where, key, q[key], P[key], Q_SCHEMA.required.includes(key))
  }
  if (!Array.isArray(q.wrong)) {
    errors.push(`${where} : « wrong » doit être une liste de mauvaises réponses`)
  } else {
    const { minItems, maxItems, items } = P.wrong
    if (q.wrong.length < minItems || q.wrong.length > maxItems)
      errors.push(`${where} : « wrong » doit contenir entre ${minItems} et ${maxItems} réponses (${q.wrong.length} trouvées)`)
    q.wrong.forEach((w, i) => checkString(errors, where, `wrong[${i}]`, w, items, true))
    const seen = new Set()
    for (const w of q.wrong.filter((w) => typeof w === 'string')) {
      if (seen.has(normAnswer(w))) errors.push(`${where} : mauvaise réponse en double « ${w} »`)
      seen.add(normAnswer(w))
    }
    if (typeof q.answer === 'string' && seen.has(normAnswer(q.answer)))
      errors.push(`${where} : la bonne réponse « ${q.answer} » apparaît aussi dans « wrong »`)
  }
  if (q.difficulty !== undefined && !P.difficulty.enum.includes(q.difficulty))
    errors.push(`${where} : « difficulty » doit valoir ${P.difficulty.enum.join(', ')}`)
  return errors.length === before
}

const byOrderThenName = (a, b) =>
  (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name, 'fr')

/**
 * Charge toute la banque de questions.
 * @returns {{ themes: object[], errors: string[], warnings: string[] }}
 */
export function loadQuestionBank(dir = join(ROOT, 'questions')) {
  const errors = []
  const warnings = []
  const themes = []
  const globalTexts = new Map()

  const themeDirs = readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort()

  for (const themeId of themeDirs) {
    const themeDir = join(dir, themeId)
    const rel = (file) => relative(ROOT, join(themeDir, file))

    if (!ID_RE.test(themeId) || RESERVED_IDS.has(themeId)) {
      errors.push(`${relative(ROOT, themeDir)} : nom de dossier invalide (minuscules, chiffres et tirets, pas « all »)`)
      continue
    }

    let meta
    try {
      meta = readJson(join(themeDir, '_theme.json'))
    } catch (e) {
      errors.push(`${rel('_theme.json')} : ${e.code === 'ENOENT' ? 'fichier manquant' : `JSON invalide — ${e.message}`}`)
      continue
    }
    if (!checkMeta(errors, rel('_theme.json'), meta, THEME_SCHEMA)) continue

    const theme = {
      id: themeId,
      name: meta.name,
      icon: meta.icon,
      description: meta.description ?? '',
      color: meta.color ?? '#6366f1',
      order: meta.order,
      subthemes: [],
    }

    const files = readdirSync(themeDir)
      .filter((f) => f.endsWith('.json') && f !== '_theme.json')
      .sort()

    for (const file of files) {
      const subId = file.slice(0, -'.json'.length)
      const where = rel(file)
      if (!ID_RE.test(subId)) {
        errors.push(`${where} : nom de fichier invalide (minuscules, chiffres et tirets)`)
        continue
      }
      let data
      try {
        data = readJson(join(themeDir, file))
      } catch (e) {
        errors.push(`${where} : JSON invalide — ${e.message}`)
        continue
      }
      if (!checkMeta(errors, where, data, SUB_SCHEMA)) continue
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        errors.push(`${where} : « questions » doit être une liste non vide`)
        continue
      }

      const questions = []
      const localTexts = new Set()
      data.questions.forEach((q, i) => {
        const qWhere = `${where} › question ${i + 1}`
        if (!checkQuestion(errors, qWhere, q)) return
        const key = norm(q.question)
        if (localTexts.has(key)) {
          errors.push(`${qWhere} : question en double dans le fichier`)
          return
        }
        localTexts.add(key)
        if (POSITIONAL_RE.test(q.explanation))
          warnings.push(`${qWhere} : l'explication semble désigner un choix par sa position, or les choix sont mélangés`)
        const other = globalTexts.get(key)
        if (other) warnings.push(`${qWhere} : même énoncé que ${other}`)
        else globalTexts.set(key, qWhere)

        questions.push({
          id: questionId(themeId, subId, q.question),
          question: q.question.trim(),
          answer: q.answer.trim(),
          wrong: q.wrong.map((w) => w.trim()),
          explanation: q.explanation.trim(),
          difficulty: q.difficulty ?? 2,
          ...(q.source ? { source: q.source } : {}),
        })
      })

      if (questions.length < 10)
        warnings.push(`${where} : seulement ${questions.length} question(s) — visez au moins 20 pour un bon mode série`)

      theme.subthemes.push({
        id: subId,
        name: data.name,
        icon: data.icon,
        description: data.description ?? '',
        order: data.order,
        questions,
      })
    }

    if (theme.subthemes.length === 0) {
      warnings.push(`${relative(ROOT, themeDir)} : aucun sous-thème, thème ignoré`)
      continue
    }
    theme.subthemes.sort(byOrderThenName)
    themes.push(theme)
  }

  themes.sort(byOrderThenName)
  return { themes, errors, warnings }
}

/**
 * Transforme la banque en fichiers statiques servis à l'app :
 *   data/catalog.json                       → thèmes, sous-thèmes, compteurs, chemins
 *   data/q/<theme>.<sous-theme>.<hash>.json → questions d'un sous-thème
 * @returns {Map<string, string>} chemin relatif → contenu
 */
export function buildDataFiles(themes) {
  const files = new Map()
  const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 8)
  const catalog = { themes: [], total: 0 }

  for (const theme of themes) {
    const { subthemes, order: _order, ...themeMeta } = theme
    const entry = { ...themeMeta, count: 0, subthemes: [] }
    for (const sub of subthemes) {
      const { questions, order: _subOrder, ...subMeta } = sub
      const content = JSON.stringify(questions)
      const file = `data/q/${theme.id}.${sub.id}.${hash(content)}.json`
      files.set(file, content)
      entry.subthemes.push({ ...subMeta, count: questions.length, file })
      entry.count += questions.length
    }
    catalog.total += entry.count
    catalog.themes.push(entry)
  }

  catalog.version = hash(JSON.stringify(catalog))
  files.set('data/catalog.json', JSON.stringify(catalog))
  return files
}

// Exécution directe : `node scripts/question-bank.mjs` → validation (CI).
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const { themes, errors, warnings } = loadQuestionBank()
  for (const w of warnings) console.warn(`⚠️  ${w}`)
  for (const e of errors) console.error(`❌ ${e}`)
  const subs = themes.flatMap((t) => t.subthemes)
  const total = subs.reduce((n, s) => n + s.questions.length, 0)
  console.log(`\n${themes.length} thèmes · ${subs.length} sous-thèmes · ${total} questions`)
  for (const t of themes) {
    console.log(`  ${t.icon} ${t.name} : ${t.subthemes.map((s) => `${s.name} (${s.questions.length})`).join(', ')}`)
  }
  if (errors.length) {
    console.error(`\n${errors.length} erreur(s) — corrigez-les avant de commit.`)
    process.exit(1)
  }
  console.log('\n✅ Banque de questions valide.')
}

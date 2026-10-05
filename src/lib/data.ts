import type { Catalog, PoolQuestion, Question, SubthemeInfo, ThemeInfo } from './types'

const url = (path: string) => `${import.meta.env.BASE_URL}${path}`

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(url(path))
  if (!res.ok) throw new Error(`Impossible de charger ${path} (${res.status})`)
  return res.json() as Promise<T>
}

let catalogPromise: Promise<Catalog> | undefined

export function loadCatalog(): Promise<Catalog> {
  catalogPromise ??= fetchJson<Catalog>('data/catalog.json').catch((e) => {
    catalogPromise = undefined
    throw e
  })
  return catalogPromise
}

export interface PoolInfo {
  key: string
  title: string
  icon: string
  color: string
  /** Vrai quand plusieurs sous-thèmes sont mélangés (on affiche alors l'origine de chaque question). */
  mixed: boolean
  parts: { theme: ThemeInfo; sub: SubthemeInfo }[]
  count: number
}

/** Décrit un mode de jeu (`all`, `<theme>` ou `<theme>/<sous-theme>`), ou null s'il n'existe pas. */
export function resolvePool(catalog: Catalog, key: string): PoolInfo | null {
  if (key === 'all') {
    const parts = catalog.themes.flatMap((theme) => theme.subthemes.map((sub) => ({ theme, sub })))
    return { key, title: 'Tout mélangé', icon: '🎲', color: '#a855f7', mixed: true, parts, count: catalog.total }
  }
  const [themeId, subId] = key.split('/')
  const theme = catalog.themes.find((t) => t.id === themeId)
  if (!theme) return null
  if (!subId) {
    const parts = theme.subthemes.map((sub) => ({ theme, sub }))
    return { key, title: theme.name, icon: theme.icon, color: theme.color, mixed: true, parts, count: theme.count }
  }
  const sub = theme.subthemes.find((s) => s.id === subId)
  if (!sub) return null
  return {
    key,
    title: sub.name,
    icon: sub.icon,
    color: theme.color,
    mixed: false,
    parts: [{ theme, sub }],
    count: sub.count,
  }
}

const fileCache = new Map<string, Promise<Question[]>>()

function loadFile(file: string) {
  let p = fileCache.get(file)
  if (!p) {
    p = fetchJson<Question[]>(file).catch((e) => {
      fileCache.delete(file)
      throw e
    })
    fileCache.set(file, p)
  }
  return p
}

export async function loadPoolQuestions(pool: PoolInfo): Promise<PoolQuestion[]> {
  const lists = await Promise.all(
    pool.parts.map(async ({ theme, sub }) =>
      (await loadFile(sub.file)).map((q) => ({ ...q, themeId: theme.id, subthemeId: sub.id })),
    ),
  )
  return lists.flat()
}

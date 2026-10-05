import type { Question } from './types'

export type Random = () => number

/** Mélange de Fisher-Yates (renvoie une copie). */
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Les choix d'une question, dans un ordre aléatoire à chaque affichage. */
export function buildChoices(q: Question, random: Random = Math.random): string[] {
  return shuffle([q.answer, ...q.wrong], random)
}

/** Plus la série est longue, plus on vise des questions difficiles. */
export function targetDifficulty(streak: number): 1 | 2 | 3 {
  if (streak < 5) return 1
  if (streak < 15) return 2
  return 3
}

/**
 * Fraîcheur d'une question pour le joueur :
 *   0 = jamais vue, 1 = vue il y a longtemps, 2 = vue récemment.
 * « Longtemps / récemment » = moitié la plus ancienne / la plus récente des
 * candidates déjà vues, d'après le compteur `seen` (id → n° d'affichage).
 */
export function freshnessBuckets(candidates: readonly Question[], seen: Readonly<Record<string, number>>) {
  const buckets = new Map<string, 0 | 1 | 2>()
  const alreadySeen = candidates.filter((q) => seen[q.id] !== undefined)
  alreadySeen.sort((a, b) => seen[a.id] - seen[b.id])
  const half = Math.ceil(alreadySeen.length / 2)
  alreadySeen.forEach((q, i) => buckets.set(q.id, i < half ? 1 : 2))
  for (const q of candidates) if (!buckets.has(q.id)) buckets.set(q.id, 0)
  return buckets
}

/**
 * Choisit la prochaine question parmi celles pas encore posées dans la partie.
 *
 * 1. Priorité aux questions les moins récemment vues (d'une partie à l'autre,
 *    on ne retombe donc pas sur les mêmes premières questions).
 * 2. À fraîcheur égale, on se rapproche de la difficulté visée pour la série.
 * 3. Le reste est tiré au hasard.
 */
export function pickNext<Q extends Question>(
  candidates: readonly Q[],
  seen: Readonly<Record<string, number>>,
  streak: number,
  random: Random = Math.random,
): Q {
  if (candidates.length === 0) throw new Error('Aucune question disponible')
  const buckets = freshnessBuckets(candidates, seen)
  const freshest = Math.min(...buckets.values())
  const fresh = candidates.filter((q) => buckets.get(q.id) === freshest)

  const target = targetDifficulty(streak)
  const distance = (q: Q) => Math.abs(q.difficulty - target)
  const best = Math.min(...fresh.map(distance))
  const finalists = fresh.filter((q) => distance(q) === best)
  return finalists[Math.floor(random() * finalists.length)]
}

/**
 * Questions encore jouables dans la partie. Quand tout a été posé (série
 * plus longue que le paquet !), on repart du paquet complet sauf la question
 * qui vient d'être jouée.
 */
export function remainingCandidates<Q extends Question>(
  pool: readonly Q[],
  askedInRun: ReadonlySet<string>,
  lastId?: string,
): { candidates: Q[]; reshuffled: boolean } {
  const candidates = pool.filter((q) => !askedInRun.has(q.id))
  if (candidates.length > 0) return { candidates, reshuffled: false }
  const again = pool.filter((q) => q.id !== lastId)
  return { candidates: again.length > 0 ? again : pool.slice(), reshuffled: true }
}

/** Clé d'un mode de jeu : `all`, `<theme>` ou `<theme>/<sous-theme>`. */
export const poolKey = (themeId?: string, subthemeId?: string) =>
  !themeId ? 'all' : subthemeId ? `${themeId}/${subthemeId}` : themeId

/** Paliers de série qui déclenchent une petite célébration. */
export const isMilestone = (streak: number) => streak === 5 || (streak > 0 && streak % 10 === 0)

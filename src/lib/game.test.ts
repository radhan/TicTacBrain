import { describe, expect, it } from 'vitest'
import { buildChoices, freshnessBuckets, isMilestone, milestoneProgress, pickNext, poolKey, remainingCandidates, shuffle, targetDifficulty } from './game'
import type { Question } from './types'

const q = (id: string, difficulty: 1 | 2 | 3 = 2): Question => ({
  id,
  question: `Question ${id} ?`,
  answer: `bonne-${id}`,
  wrong: [`a-${id}`, `b-${id}`, `c-${id}`],
  explanation: 'Parce que.',
  difficulty,
})

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('shuffle', () => {
  it('garde tous les éléments sans modifier l’original', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = shuffle(items, seeded(1))
    expect(out).toHaveLength(items.length)
    expect([...out].sort()).toEqual(items)
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('produit des ordres différents', () => {
    const random = seeded(42)
    const orders = new Set(Array.from({ length: 20 }, () => shuffle([1, 2, 3, 4, 5], random).join()))
    expect(orders.size).toBeGreaterThan(10)
  })
})

describe('buildChoices', () => {
  it('contient la bonne réponse et toutes les mauvaises', () => {
    const question = q('x')
    const choices = buildChoices(question, seeded(3))
    expect(choices).toHaveLength(4)
    expect(choices).toContain(question.answer)
    for (const w of question.wrong) expect(choices).toContain(w)
  })

  it('ne place pas toujours la bonne réponse au même endroit', () => {
    const random = seeded(7)
    const positions = new Set(Array.from({ length: 40 }, () => buildChoices(q('x'), random).indexOf('bonne-x')))
    expect(positions.size).toBe(4)
  })
})

describe('targetDifficulty', () => {
  it('monte avec la série', () => {
    expect(targetDifficulty(0)).toBe(1)
    expect(targetDifficulty(4)).toBe(1)
    expect(targetDifficulty(5)).toBe(2)
    expect(targetDifficulty(14)).toBe(2)
    expect(targetDifficulty(15)).toBe(3)
    expect(targetDifficulty(200)).toBe(3)
  })
})

describe('freshnessBuckets', () => {
  it('classe jamais vues / vues il y a longtemps / vues récemment', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'].map((id) => q(id))
    const seen = { a: 1, b: 2, c: 3, d: 4 }
    const buckets = freshnessBuckets(pool, seen)
    expect(buckets.get('e')).toBe(0)
    expect(buckets.get('a')).toBe(1)
    expect(buckets.get('b')).toBe(1)
    expect(buckets.get('c')).toBe(2)
    expect(buckets.get('d')).toBe(2)
  })
})

describe('pickNext', () => {
  it('privilégie les questions jamais vues', () => {
    const pool = ['a', 'b', 'c', 'd'].map((id) => q(id))
    const seen = { a: 1, b: 2, c: 3 }
    for (let seed = 0; seed < 20; seed++) {
      expect(pickNext(pool, seen, 0, seeded(seed)).id).toBe('d')
    }
  })

  it('à fraîcheur égale, vise la difficulté de la série', () => {
    const pool = [q('easy', 1), q('mid', 2), q('hard', 3)]
    expect(pickNext(pool, {}, 0).id).toBe('easy')
    expect(pickNext(pool, {}, 8).id).toBe('mid')
    expect(pickNext(pool, {}, 30).id).toBe('hard')
  })

  it('se rabat sur la difficulté la plus proche', () => {
    const pool = [q('mid', 2), q('hard', 3)]
    expect(pickNext(pool, {}, 0).id).toBe('mid')
  })

  it('ne rejoue pas la même séquence d’une partie à l’autre', () => {
    const pool = Array.from({ length: 30 }, (_, i) => q(`q${i}`))
    const seen: Record<string, number> = {}
    let tick = 0
    const playRun = (length: number, random: () => number) => {
      const asked = new Set<string>()
      const run: string[] = []
      for (let i = 0; i < length; i++) {
        const { candidates } = remainingCandidates(pool, asked)
        const next = pickNext(candidates, seen, i, random)
        asked.add(next.id)
        seen[next.id] = ++tick
        run.push(next.id)
      }
      return run
    }
    const random = seeded(99)
    const first = playRun(5, random)
    const second = playRun(5, random)
    // Les questions de la 1re partie ne reviennent pas tant qu'il en reste des inédites.
    expect(second.filter((id) => first.includes(id))).toEqual([])
  })
})

describe('remainingCandidates', () => {
  it('exclut les questions déjà posées dans la partie', () => {
    const pool = [q('a'), q('b'), q('c')]
    const { candidates, reshuffled } = remainingCandidates(pool, new Set(['a']))
    expect(candidates.map((c) => c.id)).toEqual(['b', 'c'])
    expect(reshuffled).toBe(false)
  })

  it('remélange quand tout a été posé, sans reposer la dernière question', () => {
    const pool = [q('a'), q('b'), q('c')]
    const { candidates, reshuffled } = remainingCandidates(pool, new Set(['a', 'b', 'c']), 'c')
    expect(candidates.map((c) => c.id)).toEqual(['a', 'b'])
    expect(reshuffled).toBe(true)
  })

  it('fonctionne avec une seule question', () => {
    const pool = [q('a')]
    expect(remainingCandidates(pool, new Set(['a']), 'a').candidates).toHaveLength(1)
  })
})

describe('divers', () => {
  it('poolKey', () => {
    expect(poolKey()).toBe('all')
    expect(poolKey('dev')).toBe('dev')
    expect(poolKey('dev', 'java')).toBe('dev/java')
  })

  it('isMilestone', () => {
    expect([0, 1, 4, 5, 6, 10, 15, 20, 30].filter(isMilestone)).toEqual([5, 10, 20, 30])
  })

  it('milestoneProgress', () => {
    expect(milestoneProgress(0)).toEqual({ target: 5, fraction: 0 })
    expect(milestoneProgress(3)).toEqual({ target: 5, fraction: 0.6 })
    expect(milestoneProgress(5)).toEqual({ target: 10, fraction: 0 })
    expect(milestoneProgress(7)).toEqual({ target: 10, fraction: 0.4 })
    expect(milestoneProgress(10)).toEqual({ target: 20, fraction: 0 })
    expect(milestoneProgress(15)).toEqual({ target: 20, fraction: 0.5 })
    expect(milestoneProgress(25)).toEqual({ target: 30, fraction: 0.5 })
  })
})

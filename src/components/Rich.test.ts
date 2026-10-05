import type { VNode } from 'preact'
import { describe, expect, it } from 'vitest'
import { renderInline } from './Rich'

/** Type des nœuds produits pour un texte, dans l'ordre (texte brut ou balise). */
function types(text: string): string[] {
  return renderInline(text).map((part) => (part && typeof part === 'object' ? (part as VNode).type as string : `text:${part}`))
}

describe('renderInline', () => {
  it('rend code, gras et italique', () => {
    expect(types('a `c` b **g** c *i* d')).toEqual(['text:a ', 'code', 'text: b ', 'strong', 'text: c ', 'em', 'text: d'])
  })

  it('ne confond pas une multiplication avec de l’italique', () => {
    // Étoiles entourées d'espaces (x * y) ou isolée (a*b) : pas d'emphase.
    expect(types('la formule x * y = k').every((t) => t.startsWith('text:'))).toBe(true)
    expect(types('un seul a*b ici').every((t) => t.startsWith('text:'))).toBe(true)
  })

  it('garde le contenu des balises', () => {
    const parts = renderInline('**gras**') as VNode[]
    expect(parts[1].type).toBe('strong')
    expect((parts[1].props as { children: string }).children).toBe('gras')
  })
})

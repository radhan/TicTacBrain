import { describe, expect, it } from 'vitest'
import { parseRoute } from './router'

describe('parseRoute', () => {
  it.each([
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#/inconnu', { name: 'home' }],
    ['#/t/hacking', { name: 'theme', themeId: 'hacking' }],
    ['#/play/all', { name: 'play', pool: 'all' }],
    ['#/play/hacking', { name: 'play', pool: 'hacking' }],
    ['#/play/hacking/web', { name: 'play', pool: 'hacking/web' }],
    ['#/play/hacking/web/en-trop', { name: 'play', pool: 'hacking/web' }],
  ])('%s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route)
  })
})

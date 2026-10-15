import { describe, expect, it } from 'vitest'

import { addRecentSearch, parseRecentSearches } from '@/lib/recent-searches'

describe('recent searches', () => {
  it('keeps the newest unique search first', () => {
    expect(addRecentSearch(['Alien', 'Dune'], '  dune  ')).toEqual(['dune', 'Alien'])
  })

  it('caps history at eight searches', () => {
    const current = Array.from({ length: 10 }, (_, index) => `search ${index}`)
    expect(addRecentSearch(current, 'new')).toHaveLength(8)
    expect(addRecentSearch(current, 'new')[0]).toBe('new')
  })

  it('ignores malformed stored history', () => {
    expect(parseRecentSearches('{nope')).toEqual([])
    expect(parseRecentSearches(JSON.stringify(['valid', 4, '', null]))).toEqual(['valid'])
  })
})

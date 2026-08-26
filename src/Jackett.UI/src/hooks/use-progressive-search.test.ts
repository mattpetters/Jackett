import { describe, expect, it } from 'vitest'

import { mergeResults } from '@/hooks/use-progressive-search'
import type { SearchResult } from '@/types/jackett'

function release(overrides: Partial<SearchResult>): SearchResult {
  return {
    Guid: 'guid',
    Title: 'Release',
    PublishDate: '2026-08-25T08:00:00Z',
    Tracker: 'Indexer',
    TrackerId: 'indexer',
    TrackerType: 'private',
    ...overrides,
  }
}

describe('mergeResults', () => {
  it('deduplicates releases and keeps newest results first', () => {
    const current = [release({ Guid: 'older', PublishDate: '2026-08-20T08:00:00Z' })]
    const incoming = [
      release({ Guid: 'newer', PublishDate: '2026-08-25T08:00:00Z' }),
      release({ Guid: 'older', Title: 'Updated duplicate', PublishDate: '2026-08-20T08:00:00Z' }),
    ]

    expect(mergeResults(current, incoming).map((item) => item.Guid)).toEqual(['newer', 'older'])
    expect(mergeResults(current, incoming)[1].Title).toBe('Updated duplicate')
  })

  it('deduplicates an info hash within one indexer while retaining cross-indexer offers', () => {
    const current = [release({ Guid: 'one', InfoHash: 'same-hash' })]
    const incoming = [
      release({ Guid: 'two', InfoHash: 'same-hash', Title: 'Updated release' }),
      release({ Guid: 'three', InfoHash: 'same-hash', TrackerId: 'another', Tracker: 'Another indexer' }),
    ]

    expect(mergeResults(current, incoming)).toHaveLength(2)
    expect(mergeResults(current, incoming).map((item) => item.Tracker)).toContain('Another indexer')
  })
})

import { describe, expect, it } from 'vitest'

import { mergeResults, TaskLimiter } from '@/hooks/use-progressive-search'
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

describe('TaskLimiter', () => {
  it('shares a fixed concurrency budget across independent work', async () => {
    const limiter = new TaskLimiter(2)
    const controller = new AbortController()
    let active = 0
    let peak = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })

    const tasks = Array.from({ length: 5 }, (_, index) =>
      limiter.run(async () => {
        active += 1
        peak = Math.max(peak, active)
        await gate
        active -= 1
        return index
      }, controller.signal),
    )

    await Promise.resolve()
    expect(peak).toBe(2)
    release()
    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2, 3, 4])
    expect(peak).toBe(2)
  })

  it('drops queued work when only that search is cancelled', async () => {
    const limiter = new TaskLimiter(1)
    const firstController = new AbortController()
    const secondController = new AbortController()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })

    const first = limiter.run(async () => gate, firstController.signal)
    const second = limiter.run(async () => 'never started', secondController.signal)
    secondController.abort(new DOMException('Cancelled', 'AbortError'))

    await expect(second).rejects.toMatchObject({ name: 'AbortError' })
    release()
    await expect(first).resolves.toBeUndefined()
  })
})

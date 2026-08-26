import { describe, expect, it } from 'vitest'

import { hasReportedSwarmStats } from '@/lib/swarm-stats'
import type { SearchResult } from '@/types/jackett'

function release(overrides: Partial<SearchResult>): SearchResult {
  return {
    Guid: 'test',
    Title: 'Test',
    PublishDate: new Date(0).toISOString(),
    Tracker: 'Test',
    TrackerId: 'test',
    TrackerType: 'public',
    ...overrides,
  }
}

describe('swarm stat reporting', () => {
  it('recognizes the 1/1 sentinel from indexers without swarm data', () => {
    expect(hasReportedSwarmStats(release({ TrackerId: 'freejavtorrent', Seeders: 1, Peers: 1 }))).toBe(false)
  })

  it('preserves a genuine one-seeder result from a reporting indexer', () => {
    expect(hasReportedSwarmStats(release({ TrackerId: 'linuxtracker', Seeders: 1, Peers: 1 }))).toBe(true)
  })

  it('preserves non-sentinel values from fallback indexers', () => {
    expect(hasReportedSwarmStats(release({ TrackerId: 'onejav', Seeders: 12, Peers: 3 }))).toBe(true)
  })
})

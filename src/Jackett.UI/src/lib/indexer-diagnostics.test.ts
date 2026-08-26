import { describe, expect, it } from 'vitest'

import { diagnoseIndexerIssue } from '@/lib/indexer-diagnostics'
import type { IndexerProgress } from '@/types/jackett'

function issue(overrides: Partial<IndexerProgress>): IndexerProgress {
  return {
    id: 'indexer',
    name: 'Indexer',
    state: 'failed',
    resultCount: 0,
    ...overrides,
  }
}

describe('diagnoseIndexerIssue', () => {
  it('recognizes timeouts', () => {
    expect(diagnoseIndexerIssue(issue({ state: 'timed-out' })).title).toContain('did not respond')
  })

  it('recognizes authentication failures', () => {
    expect(diagnoseIndexerIssue(issue({ error: 'Login failed: cookie expired' })).title).toContain('Authentication')
  })

  it('recognizes FlareSolverr failures', () => {
    expect(diagnoseIndexerIssue(issue({ error: 'FlareSolverr challenge failed' })).title).toContain('protection')
  })
})

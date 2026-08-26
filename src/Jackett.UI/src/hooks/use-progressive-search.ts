import { useCallback, useRef, useState } from 'react'

import { searchIndexer } from '@/lib/api'
import type {
  IndexerProgress,
  JackettIndexer,
  SearchOptions,
  SearchResult,
} from '@/types/jackett'

const MAX_CONCURRENT_INDEXERS = 8

function resultKey(result: SearchResult) {
  return `${result.TrackerId}:${result.InfoHash || result.Guid || result.Title}`
}

export function mergeResults(current: SearchResult[], incoming: SearchResult[]) {
  const merged = new Map(current.map((result) => [resultKey(result), result]))
  incoming.forEach((result) => merged.set(resultKey(result), result))
  return [...merged.values()].sort(
    (a, b) => Date.parse(b.PublishDate) - Date.parse(a.PublishDate),
  )
}

function initialProgress(indexers: JackettIndexer[]): IndexerProgress[] {
  return indexers.map((indexer) => ({
    id: indexer.id,
    name: indexer.name,
    state: 'queued',
    resultCount: 0,
  }))
}

export function useProgressiveSearch() {
  const abortController = useRef<AbortController | null>(null)
  const runId = useRef(0)
  const [results, setResults] = useState<SearchResult[]>([])
  const [progress, setProgress] = useState<IndexerProgress[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finishedAt, setFinishedAt] = useState<number | null>(null)

  const updateIndexer = useCallback(
    (id: string, update: Partial<IndexerProgress>) => {
      setProgress((current) =>
        current.map((item) => (item.id === id ? { ...item, ...update } : item)),
      )
    },
    [],
  )

  const cancel = useCallback(() => {
    abortController.current?.abort(new DOMException('Search cancelled', 'AbortError'))
    abortController.current = null
    setIsSearching(false)
    setFinishedAt(Date.now())
    setProgress((current) =>
      current.map((item) =>
        item.state === 'queued' || item.state === 'searching'
          ? { ...item, state: 'cancelled' }
          : item,
      ),
    )
  }, [])

  const search = useCallback(
    async ({ query, indexers, categories, apiKey }: SearchOptions) => {
      abortController.current?.abort()
      const controller = new AbortController()
      abortController.current = controller
      const currentRun = ++runId.current
      let cursor = 0

      setResults([])
      setProgress(initialProgress(indexers))
      setIsSearching(true)
      setStartedAt(Date.now())
      setFinishedAt(null)

      const worker = async () => {
        while (!controller.signal.aborted) {
          const indexer = indexers[cursor++]
          if (!indexer) return

          const requestStartedAt = performance.now()
          updateIndexer(indexer.id, { state: 'searching' })

          try {
            const response = await searchIndexer(
              indexer.id,
              query,
              categories,
              apiKey,
              controller.signal,
            )
            if (runId.current !== currentRun) return

            const indexerResult = response.Indexers[0]
            const elapsedMs = indexerResult?.ElapsedTime || performance.now() - requestStartedAt
            setResults((current) => mergeResults(current, response.Results || []))
            updateIndexer(indexer.id, {
              state: indexerResult?.Error ? 'failed' : 'complete',
              resultCount: response.Results?.length || 0,
              elapsedMs,
              error: indexerResult?.Error,
            })
          } catch (error) {
            if (runId.current !== currentRun) return
            const exception = error instanceof Error ? error : new Error(String(error))
            const cancelled = controller.signal.aborted
            updateIndexer(indexer.id, {
              state: cancelled
                ? 'cancelled'
                : exception.name === 'TimeoutError' || exception.message.includes('timed out')
                  ? 'timed-out'
                  : 'failed',
              elapsedMs: performance.now() - requestStartedAt,
              error: cancelled ? undefined : exception.message,
            })
          }
        }
      }

      const workerCount = Math.min(MAX_CONCURRENT_INDEXERS, indexers.length)
      await Promise.all(Array.from({ length: workerCount }, worker))

      if (runId.current === currentRun) {
        setIsSearching(false)
        setFinishedAt(Date.now())
        abortController.current = null
      }
    },
    [updateIndexer],
  )

  return {
    results,
    progress,
    isSearching,
    startedAt,
    finishedAt,
    search,
    cancel,
    setResults,
  }
}

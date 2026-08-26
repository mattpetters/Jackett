import { useCallback, useRef, useState } from 'react'

import { searchIndexer } from '@/lib/api'
import type {
  IndexerProgress,
  JackettIndexer,
  SearchOptions,
  SearchResult,
  SearchSession,
} from '@/types/jackett'

const MAX_CONCURRENT_REQUESTS = 8
const MAX_WORKERS_PER_SESSION = 8

type QueuedTask = {
  run: () => void
  isCancelled: () => boolean
}

export class TaskLimiter {
  private active = 0
  private readonly queue: QueuedTask[] = []

  constructor(private readonly maximum: number) {}

  run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(signal.reason)

    return new Promise<T>((resolve, reject) => {
      let started = false
      let cancelled = false

      const abortWhileQueued = () => {
        if (started) return
        cancelled = true
        reject(signal.reason || new DOMException('Search cancelled', 'AbortError'))
      }

      signal.addEventListener('abort', abortWhileQueued, { once: true })
      this.queue.push({
        isCancelled: () => cancelled,
        run: () => {
          started = true
          signal.removeEventListener('abort', abortWhileQueued)
          this.active += 1
          void Promise.resolve()
            .then(() => {
              if (signal.aborted) throw signal.reason
              return task()
            })
            .then(resolve, reject)
            .finally(() => {
              this.active -= 1
              this.drain()
            })
        },
      })
      this.drain()
    })
  }

  private drain() {
    while (this.active < this.maximum && this.queue.length) {
      const next = this.queue.shift()!
      if (next.isCancelled()) continue
      next.run()
    }
  }
}

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
  const controllers = useRef(new Map<string, AbortController>())
  const limiter = useRef(new TaskLimiter(MAX_CONCURRENT_REQUESTS))
  const [sessions, setSessions] = useState<SearchSession[]>([])

  const updateSession = useCallback(
    (sessionId: string, update: (session: SearchSession) => SearchSession) => {
      setSessions((current) =>
        current.map((session) => (session.id === sessionId ? update(session) : session)),
      )
    },
    [],
  )

  const updateIndexer = useCallback(
    (sessionId: string, indexerId: string, update: Partial<IndexerProgress>) => {
      updateSession(sessionId, (session) => ({
        ...session,
        progress: session.progress.map((item) =>
          item.id === indexerId ? { ...item, ...update } : item,
        ),
      }))
    },
    [updateSession],
  )

  const cancel = useCallback((sessionId: string) => {
    const controller = controllers.current.get(sessionId)
    if (!controller || controller.signal.aborted) return

    controller.abort(new DOMException('Search cancelled', 'AbortError'))
    controllers.current.delete(sessionId)
    updateSession(sessionId, (session) => ({
      ...session,
      status: 'cancelled',
      finishedAt: session.finishedAt || Date.now(),
      progress: session.progress.map((item) =>
        item.state === 'queued' || item.state === 'searching'
          ? { ...item, state: 'cancelled' }
          : item,
      ),
    }))
  }, [updateSession])

  const remove = useCallback((sessionId: string) => {
    const controller = controllers.current.get(sessionId)
    if (controller && !controller.signal.aborted) {
      controller.abort(new DOMException('Search removed', 'AbortError'))
      controllers.current.delete(sessionId)
    }
    setSessions((current) => current.filter((session) => session.id !== sessionId))
  }, [])

  const clearSettled = useCallback(() => {
    setSessions((current) => current.filter((session) => session.status === 'searching'))
  }, [])

  const search = useCallback(
    ({ query, indexers, categories, apiKey }: SearchOptions) => {
      const sessionId = crypto.randomUUID()
      const controller = new AbortController()
      controllers.current.set(sessionId, controller)
      let cursor = 0

      const session: SearchSession = {
        id: sessionId,
        query,
        results: [],
        progress: initialProgress(indexers),
        status: 'searching',
        startedAt: Date.now(),
        finishedAt: null,
        indexerCount: indexers.length,
        categoryCount: categories.length,
      }
      setSessions((current) => [session, ...current])

      const worker = async () => {
        while (!controller.signal.aborted) {
          const indexer = indexers[cursor++]
          if (!indexer) return
          let requestStartedAt = performance.now()

          try {
            const response = await limiter.current.run(async () => {
              requestStartedAt = performance.now()
              updateIndexer(sessionId, indexer.id, { state: 'searching' })
              return searchIndexer(
                indexer.id,
                query,
                categories,
                apiKey,
                controller.signal,
              )
            }, controller.signal)

            const indexerResult = response.Indexers[0]
            const elapsedMs = indexerResult?.ElapsedTime || performance.now() - requestStartedAt
            updateSession(sessionId, (current) => ({
              ...current,
              results: mergeResults(current.results, response.Results || []),
            }))
            updateIndexer(sessionId, indexer.id, {
              state: indexerResult?.Error ? 'failed' : 'complete',
              resultCount: response.Results?.length || 0,
              elapsedMs,
              error: indexerResult?.Error,
            })
          } catch (error) {
            const exception = error instanceof Error ? error : new Error(String(error))
            const cancelled = controller.signal.aborted
            updateIndexer(sessionId, indexer.id, {
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

      void (async () => {
        const workerCount = Math.min(MAX_WORKERS_PER_SESSION, indexers.length)
        await Promise.all(Array.from({ length: workerCount }, worker))
        controllers.current.delete(sessionId)
        updateSession(sessionId, (current) => ({
          ...current,
          status: controller.signal.aborted ? 'cancelled' : 'complete',
          finishedAt: current.finishedAt || Date.now(),
          progress: controller.signal.aborted
            ? current.progress.map((item) =>
                item.state === 'queued' || item.state === 'searching'
                  ? { ...item, state: 'cancelled' }
                  : item,
              )
            : current.progress,
        }))
      })()

      return sessionId
    },
    [updateIndexer, updateSession],
  )

  return {
    sessions,
    search,
    cancel,
    remove,
    clearSettled,
  }
}

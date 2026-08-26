import type {
  JackettIndexer,
  IndexerConfigItem,
  IndexerConfigUpdate,
  ManualSearchResponse,
  SearchResult,
  ServerConfig,
} from '@/types/jackett'

function getBasePath() {
  const uiMarker = '/UI/'
  const markerIndex = window.location.pathname.indexOf(uiMarker)
  return markerIndex >= 0 ? window.location.pathname.slice(0, markerIndex) : ''
}

function getApiRoot() {
  return `${getBasePath()}/api/v2.0`
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

async function mutate(url: string, method: 'POST' | 'DELETE', body?: unknown) {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string }
      throw new Error(parsed.error || parsed.message || `${response.status} ${response.statusText}`)
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(text || `${response.status} ${response.statusText}`)
      }
      throw error
    }
  }
}

export function getUiPath(action: 'Dashboard' | 'Legacy' | 'Logout') {
  return `${getBasePath()}/UI/${action}`
}

export async function getServerConfig(signal?: AbortSignal) {
  return getJson<ServerConfig>(`${getApiRoot()}/server/config`, signal)
}

export async function getConfiguredIndexers(signal?: AbortSignal) {
  return getJson<JackettIndexer[]>(`${getApiRoot()}/indexers?configured=true`, signal)
}

export async function getCachedResults(signal?: AbortSignal) {
  return getJson<SearchResult[]>(`${getApiRoot()}/indexers/cache`, signal)
}

export async function getIndexerConfig(indexerId: string, signal?: AbortSignal) {
  return getJson<IndexerConfigItem[]>(
    `${getApiRoot()}/indexers/${encodeURIComponent(indexerId)}/config`,
    signal,
  )
}

export async function updateIndexerConfig(indexerId: string, config: IndexerConfigUpdate[]) {
  return mutate(
    `${getApiRoot()}/indexers/${encodeURIComponent(indexerId)}/config`,
    'POST',
    config,
  )
}

export async function testIndexer(indexerId: string) {
  return mutate(`${getApiRoot()}/indexers/${encodeURIComponent(indexerId)}/test`, 'POST')
}

export async function deleteIndexer(indexerId: string) {
  return mutate(`${getApiRoot()}/indexers/${encodeURIComponent(indexerId)}`, 'DELETE')
}

function combineSignals(parent: AbortSignal, timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort(new DOMException('Indexer timed out', 'TimeoutError'))
  }, timeoutMs)
  const abortFromParent = () => controller.abort(parent.reason)
  parent.addEventListener('abort', abortFromParent, { once: true })
  if (parent.aborted) abortFromParent()

  return {
    signal: controller.signal,
    dispose: () => {
      window.clearTimeout(timeoutId)
      parent.removeEventListener('abort', abortFromParent)
    },
  }
}

export async function searchIndexer(
  indexerId: string,
  query: string,
  categoryIds: string[],
  apiKey: string,
  parentSignal: AbortSignal,
  timeoutMs = 45_000,
) {
  const params = new URLSearchParams({ apikey: apiKey, Query: query })
  categoryIds.forEach((category) => params.append('Category[]', category))
  const { signal, dispose } = combineSignals(parentSignal, timeoutMs)

  try {
    return await getJson<ManualSearchResponse>(
      `${getApiRoot()}/indexers/${encodeURIComponent(indexerId)}/results?${params}`,
      signal,
    )
  } finally {
    dispose()
  }
}

import type {
  JackettIndexer,
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

function combineSignals(parent: AbortSignal, timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort(new DOMException('Indexer timed out', 'TimeoutError'))
  }, timeoutMs)
  const abortFromParent = () => controller.abort(parent.reason)
  parent.addEventListener('abort', abortFromParent, { once: true })

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

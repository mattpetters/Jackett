export interface Capability {
  ID: string
  Name: string
}

export interface JackettIndexer {
  id: string
  name: string
  description: string
  type: 'public' | 'private' | 'semi-private' | string
  configured: boolean
  site_link: string
  alternativesitelinks: string[]
  language: string
  tags: string[]
  last_error: string
  potatoenabled: boolean
  caps: Capability[]
}

export interface ServerConfig {
  api_key: string
  app_version: string
  cache_enabled: boolean
  cache_ttl: number
  notices: string[]
  flaresolverrurl: string
  basepathoverride: string
}

export interface SearchResult {
  Guid: string
  Title: string
  Link?: string
  Details?: string
  PublishDate: string
  FirstSeen?: string
  Category?: number[]
  CategoryDesc?: string
  Size?: number
  Files?: number
  Grabs?: number
  Seeders?: number
  Peers?: number
  Tracker: string
  TrackerId: string
  TrackerType: string
  MagnetUri?: string
  BlackholeLink?: string
  Poster?: string
  InfoHash?: string
  DownloadVolumeFactor?: number
  UploadVolumeFactor?: number
}

export interface ManualSearchIndexerResult {
  ID: string
  Name: string
  Status: number
  Results: number
  Error?: string
  ElapsedTime: number
}

export interface ManualSearchResponse {
  Results: SearchResult[]
  Indexers: ManualSearchIndexerResult[]
}

export type IndexerSearchState =
  | 'queued'
  | 'searching'
  | 'complete'
  | 'failed'
  | 'timed-out'
  | 'cancelled'

export interface IndexerProgress {
  id: string
  name: string
  state: IndexerSearchState
  resultCount: number
  elapsedMs?: number
  error?: string
}

export interface SearchOptions {
  query: string
  indexers: JackettIndexer[]
  categories: string[]
  apiKey: string
}

export type SearchSessionStatus = 'searching' | 'complete' | 'cancelled'

export interface SearchSession {
  id: string
  query: string
  results: SearchResult[]
  progress: IndexerProgress[]
  status: SearchSessionStatus
  startedAt: number
  finishedAt: number | null
  indexerCount: number
  categoryCount: number
}

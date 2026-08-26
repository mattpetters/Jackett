import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Archive,
  ExternalLink,
  Gauge,
  Github,
  Moon,
  Search,
  ServerCog,
  Square,
  Sun,
  Waves,
} from 'lucide-react'

import { CommandMenu } from '@/components/command-menu'
import { ResultsTable } from '@/components/results-table'
import { SearchFilters } from '@/components/search-filters'
import { TrackerProgress } from '@/components/tracker-progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MagnifyingGlassIcon, type IconHandle } from '@/components/ui/icons/magnifying-glass'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getCachedResults, getConfiguredIndexers, getServerConfig, getUiPath } from '@/lib/api'
import { addRecentSearch, parseRecentSearches } from '@/lib/recent-searches'
import { cn } from '@/lib/utils'
import { useProgressiveSearch } from '@/hooks/use-progressive-search'
import type { Capability, SearchResult } from '@/types/jackett'

const INDEXER_STORAGE_KEY = 'jackett:selected-indexers'
const THEME_STORAGE_KEY = 'jackett:theme'
const RECENT_SEARCH_STORAGE_KEY = 'jackett:recent-searches'

function useElapsed(startedAt: number | null, finishedAt: number | null) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!startedAt || finishedAt) return
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [finishedAt, startedAt])
  return startedAt ? Math.max(0, (finishedAt || now) - startedAt) : 0
}

function formatDuration(milliseconds: number) {
  if (!milliseconds) return '0.0s'
  return `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 1 : 0)}s`
}

function App() {
  const bootstrap = useQuery({
    queryKey: ['jackett-bootstrap'],
    queryFn: async ({ signal }) => {
      const [config, indexers] = await Promise.all([
        getServerConfig(signal),
        getConfiguredIndexers(signal),
      ])
      return { config, indexers }
    },
  })
  const cache = useQuery({
    queryKey: ['jackett-cache'],
    queryFn: ({ signal }) => getCachedResults(signal),
    enabled: false,
  })
  const progressive = useProgressiveSearch()
  const initialQuery = new URLSearchParams(window.location.search).get('q') || ''
  const [query, setQuery] = useState(initialQuery)
  const [lastQuery, setLastQuery] = useState(initialQuery)
  const [selectedIndexerIds, setSelectedIndexerIds] = useState<Set<string>>(new Set())
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'live' | 'cache'>('live')
  const [validationMessage, setValidationMessage] = useState('')
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState(() =>
    parseRecentSearches(localStorage.getItem(RECENT_SEARCH_STORAGE_KEY)),
  )
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return saved === 'light' ? 'light' : 'dark'
  })
  const selectionInitialized = useRef(false)
  const autoSearchStarted = useRef(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const animatedSearchIcon = useRef<IconHandle>(null)

  const indexers = useMemo(() => bootstrap.data?.indexers || [], [bootstrap.data?.indexers])
  const config = bootstrap.data?.config

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!indexers.length || selectionInitialized.current) return
    selectionInitialized.current = true
    const saved = localStorage.getItem(INDEXER_STORAGE_KEY)
    const savedIds = saved ? new Set<string>(JSON.parse(saved) as string[]) : null
    const knownIds = new Set(indexers.map((indexer) => indexer.id))
    const selected = savedIds
      ? new Set([...savedIds].filter((id) => knownIds.has(id)))
      : knownIds
    setSelectedIndexerIds(selected.size ? selected : knownIds)
  }, [indexers])

  useEffect(() => {
    if (!selectionInitialized.current) return
    localStorage.setItem(INDEXER_STORAGE_KEY, JSON.stringify([...selectedIndexerIds]))
  }, [selectedIndexerIds])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandMenuOpen((current) => !current)
        return
      }

      const target = event.target
      const isEditable = target instanceof HTMLElement && (
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      )

      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditable) {
        event.preventDefault()
        setMode('live')
        searchInput.current?.focus()
      }

      if (event.key === 'Escape' && target === searchInput.current) {
        searchInput.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectedIndexers = useMemo(
    () => indexers.filter((indexer) => selectedIndexerIds.has(indexer.id)),
    [indexers, selectedIndexerIds],
  )
  const categories = useMemo(() => {
    const categoryMap = new Map<string, Capability>()
    indexers.forEach((indexer) => {
      indexer.caps.forEach((category) => {
        if (Number(category.ID) < 100000 && !categoryMap.has(category.ID)) {
          categoryMap.set(category.ID, category)
        }
      })
    })
    return [...categoryMap.values()].sort((a, b) => Number(a.ID) - Number(b.ID))
  }, [indexers])

  const runSearch = (searchQuery: string) => {
    if (!config) return
    const cleanQuery = searchQuery.trim()
    if (!cleanQuery) {
      setValidationMessage('Give me a title, release name, or keyword to hunt for.')
      searchInput.current?.focus()
      return
    }
    if (!selectedIndexers.length) {
      setValidationMessage('Select at least one indexer before searching.')
      return
    }

    setValidationMessage('')
    setMode('live')
    setLastQuery(cleanQuery)
    setRecentSearches((current) => {
      const next = addRecentSearch(current, cleanQuery)
      localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(next))
      return next
    })
    const url = new URL(window.location.href)
    url.searchParams.set('q', cleanQuery)
    window.history.replaceState({}, '', url)
    animatedSearchIcon.current?.startAnimation()
    void progressive.search({
      query: cleanQuery,
      indexers: selectedIndexers,
      categories: [...selectedCategoryIds],
      apiKey: config.api_key,
    })
  }

  useEffect(() => {
    if (!initialQuery || !config || !selectedIndexers.length || autoSearchStarted.current) return
    autoSearchStarted.current = true
    runSearch(initialQuery)
    // This deliberately runs once after bootstrap and saved indexer selection are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, selectedIndexers.length])

  useEffect(() => {
    if (!progressive.isSearching) animatedSearchIcon.current?.stopAnimation()
  }, [progressive.isSearching])

  const elapsed = useElapsed(progressive.startedAt, progressive.finishedAt)
  const failedCount = progressive.progress.filter((item) => item.state === 'failed' || item.state === 'timed-out').length
  const completedCount = progressive.progress.filter((item) => item.state === 'complete').length
  const displayedResults: SearchResult[] = mode === 'cache' ? cache.data || [] : progressive.results

  async function showCache() {
    progressive.cancel()
    const response = await cache.refetch()
    if (response.data) setMode('cache')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    runSearch(query)
  }

  function focusReleaseSearch() {
    setMode('live')
    window.requestAnimationFrame(() => {
      searchInput.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      searchInput.current?.focus()
      searchInput.current?.select()
    })
  }

  function clearRecentSearches() {
    localStorage.removeItem(RECENT_SEARCH_STORAGE_KEY)
    setRecentSearches([])
  }

  if (bootstrap.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="glass-panel max-w-lg">
          <CardContent className="space-y-3 p-7 text-center">
            <ServerCog className="mx-auto size-8 text-destructive" />
            <h1 className="text-xl font-semibold">Jackett didn’t answer</h1>
            <p className="text-sm text-muted-foreground">{bootstrap.error instanceof Error ? bootstrap.error.message : 'The dashboard APIs could not be loaded.'}</p>
            <Button onClick={() => void bootstrap.refetch()}>Try again</Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <TooltipProvider delayDuration={350}>
      <CommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        recentSearches={recentSearches}
        selectedIndexerCount={selectedIndexers.length}
        selectedCategoryCount={selectedCategoryIds.size}
        isSearching={progressive.isSearching}
        theme={theme}
        onSearch={(value) => {
          setQuery(value)
          runSearch(value)
        }}
        onFocusSearch={focusReleaseSearch}
        onShowCache={() => void showCache()}
        onSelectAllIndexers={() => setSelectedIndexerIds(new Set(indexers.map((indexer) => indexer.id)))}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onOpenAdmin={() => window.location.assign(getUiPath('Legacy'))}
        onCancelSearch={progressive.cancel}
        onClearRecentSearches={clearRecentSearches}
      />
      <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar/75 px-3 py-4 backdrop-blur-xl lg:flex">
          <a href={getUiPath('Dashboard')} className="flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="relative flex size-10 items-center justify-center overflow-hidden rounded-xl bg-primary/12 ring-1 ring-primary/20">
              <img src="../jacket_medium.png" alt="" className="size-8 object-contain" />
            </div>
            <div>
              <p className="font-semibold tracking-tight">Jackett</p>
              <p className="text-[11px] text-muted-foreground">search workspace</p>
            </div>
          </a>

          <nav className="mt-7 space-y-1">
            <button type="button" onClick={focusReleaseSearch} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', mode === 'live' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
              <Search className="size-4" /> Search
            </button>
            <button type="button" onClick={() => void showCache()} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', mode === 'cache' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
              <Archive className="size-4" /> Cached releases
            </button>
            <a href={getUiPath('Legacy')} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <ServerCog className="size-4" /> Indexer admin <ExternalLink className="ml-auto size-3" />
            </a>
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-xl border bg-background/30 p-3">
              <div className="flex items-center gap-2 text-xs font-medium"><span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_theme(colors.emerald.500)]" /> Jackett online</div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{indexers.length} configured indexers</p>
            </div>
            <div className="flex items-center justify-between px-2 text-[11px] text-muted-foreground">
              <span>v{config?.app_version || '…'}</span>
              <a href="https://github.com/mattpetters/Jackett" target="_blank" rel="noreferrer" className="hover:text-foreground"><Github className="size-3.5" /></a>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b bg-background/72 backdrop-blur-xl">
            <div className="mx-auto flex h-15 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-2 lg:hidden">
                <img src="../jacket_medium.png" alt="" className="size-8 object-contain" />
                <span className="font-semibold">Jackett</span>
              </div>
              <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
                <Waves className="size-3.5 text-primary" /> Progressive search enabled
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 bg-background/45 px-2.5" onClick={() => setCommandMenuOpen(true)} aria-label="Open command menu">
                      <Search className="size-3.5" />
                      <span className="hidden sm:inline">Commands</span>
                      <kbd className="rounded border bg-muted/60 px-1 font-sans text-[10px] text-muted-foreground">⌘K</kbd>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open command menu · ⌘K</TooltipContent>
                </Tooltip>
                <Button variant="ghost" size="icon" className="size-9 lg:hidden" onClick={() => void showCache()} aria-label="Cached releases">
                  <Archive />
                </Button>
                <Button variant="ghost" size="icon" className="size-9" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
                  {theme === 'dark' ? <Sun /> : <Moon />}
                </Button>
                <Button asChild variant="ghost" size="icon" className="size-9 lg:hidden">
                  <a href={getUiPath('Legacy')} aria-label="Indexer admin"><ServerCog /></a>
                </Button>
                <Button asChild variant="outline" size="sm" className="hidden bg-background/45 sm:inline-flex"><a href={getUiPath('Legacy')}>Admin</a></Button>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
            {config?.notices?.map((notice) => (
              <div key={notice} className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">{notice}</div>
            ))}

            <section className="space-y-5">
              <div className="max-w-3xl">
                <Badge variant="outline" className="mb-3 bg-background/40 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Live metasearch</Badge>
                <h1 className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                  Find the release. <span className="text-muted-foreground">Skip the waiting.</span>
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Results arrive the moment each indexer responds. One slow tracker never holds the whole search hostage.
                </p>
              </div>

              <form onSubmit={submit} className="glass-panel search-glow rounded-2xl p-2 transition-[border-color,box-shadow] duration-300">
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <div className="relative min-w-0 flex-1">
                    <MagnifyingGlassIcon ref={animatedSearchIcon} size={23} className="absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInput}
                      data-testid="search-input"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onFocus={() => setMode('live')}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') event.currentTarget.blur()
                      }}
                      placeholder="Search releases across every indexer…"
                      className="h-13 border-0 bg-transparent pl-12 pr-14 text-base shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-0 sm:text-lg"
                      aria-keyshortcuts="/"
                    />
                    <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border bg-muted/60 px-2 py-0.5 font-sans text-[11px] text-muted-foreground sm:block">/</kbd>
                  </div>
                  <Separator orientation="vertical" className="hidden h-7 md:block" />
                  <div className="flex items-center gap-2 px-1 pb-1 md:pb-0">
                    <SearchFilters
                      indexers={indexers}
                      selectedIndexerIds={selectedIndexerIds}
                      onIndexerIdsChange={setSelectedIndexerIds}
                      categories={categories}
                      selectedCategoryIds={selectedCategoryIds}
                      onCategoryIdsChange={setSelectedCategoryIds}
                    />
                    {progressive.isSearching ? (
                      <Button type="button" variant="secondary" className="h-10" onClick={progressive.cancel}><Square className="fill-current" /> Stop</Button>
                    ) : (
                      <Button type="submit" className="h-10 min-w-28 shadow-lg shadow-primary/15"><Search /> Search</Button>
                    )}
                  </div>
                </div>
              </form>
              {validationMessage ? <p className="px-2 text-sm text-destructive">{validationMessage}</p> : null}
            </section>

            {progressive.progress.length && mode === 'live' ? <TrackerProgress items={progressive.progress} /> : null}

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard icon={Activity} label={mode === 'cache' ? 'Cached releases' : 'Releases found'} value={displayedResults.length.toLocaleString()} accent />
              <MetricCard icon={Gauge} label="Responded" value={mode === 'cache' ? 'Cache' : `${completedCount}/${progressive.progress.length || selectedIndexers.length}`} />
              <MetricCard icon={Waves} label="Elapsed" value={mode === 'cache' ? 'Instant' : formatDuration(elapsed)} />
              <MetricCard icon={ServerCog} label="Issues" value={mode === 'cache' ? '—' : String(failedCount)} warning={failedCount > 0} />
            </section>

            <section data-testid="results-workspace" className="glass-panel rounded-2xl p-3 sm:p-5">
              <div className="mb-5 flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{mode === 'cache' ? 'Cached releases' : 'Search results'}</h2>
                    {progressive.isSearching && mode === 'live' ? <Badge className="progress-shimmer border-primary/20 bg-primary/8 text-primary" variant="outline">Live</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mode === 'cache' ? 'Recently returned by Jackett across all searches.' : lastQuery ? <>Showing matches for <span className="font-medium text-foreground">“{lastQuery}”</span></> : 'Fresh results will stream in here.'}
                  </p>
                </div>
                {mode === 'cache' ? <Button variant="ghost" size="sm" onClick={focusReleaseSearch}>Back to live search</Button> : null}
              </div>
              {bootstrap.isPending || cache.isFetching ? (
                <div className="space-y-3"><Skeleton className="h-10 w-80 max-w-full" /><Skeleton className="h-60 w-full" /></div>
              ) : (
                <ResultsTable results={displayedResults} searching={progressive.isSearching && mode === 'live'} />
              )}
            </section>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent = false,
  warning = false,
}: {
  icon: typeof Activity
  label: string
  value: string
  accent?: boolean
  warning?: boolean
}) {
  return (
    <Card className="glass-panel gap-0 overflow-hidden py-0">
      <CardContent className="flex items-center gap-3 p-4 sm:p-5">
        <div className={cn('hidden size-9 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground sm:flex', accent && 'bg-primary/10 text-primary', warning && 'bg-amber-500/10 text-amber-500')}><Icon className="size-4" /></div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className={cn('mt-0.5 text-xl font-semibold tabular-nums tracking-tight', accent && 'text-primary', warning && 'text-amber-500')}>{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default App

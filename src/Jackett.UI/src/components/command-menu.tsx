import { useState } from 'react'
import { Command } from 'cmdk'
import {
  Archive,
  CheckCircle2,
  Clock3,
  Moon,
  Search,
  ServerCog,
  SlidersHorizontal,
  Square,
  Sun,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recentSearches: string[]
  selectedIndexerCount: number
  selectedCategoryCount: number
  isSearching: boolean
  theme: 'light' | 'dark'
  onSearch: (query: string) => void
  onFocusSearch: () => void
  onShowCache: () => void
  onSelectAllIndexers: () => void
  onToggleTheme: () => void
  onOpenAdmin: () => void
  onCancelSearch: () => void
  onClearRecentSearches: () => void
}

const itemClassName =
  'group flex min-h-12 cursor-default select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-45'

function Shortcut({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-auto rounded-md border bg-background/55 px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground shadow-sm">
      {children}
    </kbd>
  )
}

function ItemIcon({ children, destructive = false }: { children: React.ReactNode; destructive?: boolean }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background/55 text-muted-foreground transition-colors group-data-[selected=true]:border-primary/20 group-data-[selected=true]:bg-primary/10 group-data-[selected=true]:text-primary',
        destructive && 'group-data-[selected=true]:border-destructive/20 group-data-[selected=true]:bg-destructive/10 group-data-[selected=true]:text-destructive',
      )}
    >
      {children}
    </span>
  )
}

export function CommandMenu({
  open,
  onOpenChange,
  recentSearches,
  selectedIndexerCount,
  selectedCategoryCount,
  isSearching,
  theme,
  onSearch,
  onFocusSearch,
  onShowCache,
  onSelectAllIndexers,
  onToggleTheme,
  onOpenAdmin,
  onCancelSearch,
  onClearRecentSearches,
}: CommandMenuProps) {
  const [search, setSearch] = useState('')
  const cleanSearch = search.trim()

  function closeThen(action: () => void) {
    onOpenChange(false)
    setSearch('')
    window.requestAnimationFrame(action)
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
    if (!nextOpen) setSearch('')
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={handleOpenChange}
      label="Jackett command menu"
      loop
      overlayClassName="fixed inset-0 z-50 bg-black/60 backdrop-blur-[3px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      contentClassName="fixed left-1/2 top-[9vh] z-50 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border bg-popover/96 text-popover-foreground shadow-2xl shadow-black/35 outline-none backdrop-blur-2xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:top-[15vh]"
    >
      <div className="flex items-center gap-3 border-b px-4">
        <Search className="size-5 shrink-0 text-primary" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search releases or type a command…"
          className="h-16 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-lg"
          autoFocus
        />
        <kbd className="rounded-md border bg-muted/60 px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">ESC</kbd>
      </div>

      <Command.List className="max-h-[min(60vh,29rem)] scroll-py-2 overflow-y-auto overscroll-contain p-2">
        <Command.Empty className="px-4 py-12 text-center text-sm text-muted-foreground">
          No matching commands.
        </Command.Empty>

        {cleanSearch ? (
          <Command.Group heading="Search" className="command-group">
            <Command.Item
              value={`search releases ${cleanSearch}`}
              keywords={[cleanSearch, 'find', 'torrent', 'release']}
              onSelect={() => closeThen(() => onSearch(cleanSearch))}
              className={itemClassName}
            >
              <ItemIcon><Search className="size-4" /></ItemIcon>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">Search for “{cleanSearch}”</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {selectedIndexerCount} indexers
                  {selectedCategoryCount ? ` · ${selectedCategoryCount} categories` : ' · all categories'}
                </p>
              </div>
              <Shortcut>↵</Shortcut>
            </Command.Item>
          </Command.Group>
        ) : null}

        {recentSearches.length ? (
          <Command.Group heading="Recent searches" className="command-group">
            {recentSearches.map((recent) => (
              <Command.Item
                key={recent}
                value={`recent search ${recent}`}
                keywords={[recent, 'history']}
                onSelect={() => closeThen(() => onSearch(recent))}
                className={itemClassName}
              >
                <ItemIcon><Clock3 className="size-4" /></ItemIcon>
                <span className="min-w-0 flex-1 truncate">{recent}</span>
                <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-data-[selected=true]:opacity-100">Search again</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        <Command.Group heading="Navigate and act" className="command-group">
          <Command.Item
            value="focus release search"
            keywords={['find', 'torrent', 'query', 'slash']}
            onSelect={() => closeThen(onFocusSearch)}
            className={itemClassName}
          >
            <ItemIcon><Search className="size-4" /></ItemIcon>
            <span>Focus release search</span>
            <Shortcut>/</Shortcut>
          </Command.Item>
          <Command.Item
            value="view cached releases"
            keywords={['history', 'results', 'cache']}
            onSelect={() => closeThen(onShowCache)}
            className={itemClassName}
          >
            <ItemIcon><Archive className="size-4" /></ItemIcon>
            <span>View cached releases</span>
          </Command.Item>
          <Command.Item
            value="select all indexers"
            keywords={['trackers', 'scope', 'filters']}
            onSelect={() => closeThen(onSelectAllIndexers)}
            className={itemClassName}
          >
            <ItemIcon><SlidersHorizontal className="size-4" /></ItemIcon>
            <span className="flex-1">Search all indexers</span>
            <Badge variant="secondary" className="font-normal">{selectedIndexerCount} selected</Badge>
          </Command.Item>
          {isSearching ? (
            <Command.Item
              value="stop active search"
              keywords={['cancel', 'end', 'abort']}
              onSelect={() => closeThen(onCancelSearch)}
              className={itemClassName}
            >
              <ItemIcon destructive><Square className="size-3.5 fill-current" /></ItemIcon>
              <span>Stop active search</span>
            </Command.Item>
          ) : null}
          <Command.Item
            value={`switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            keywords={['appearance', 'mode', 'color']}
            onSelect={() => closeThen(onToggleTheme)}
            className={itemClassName}
          >
            <ItemIcon>{theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}</ItemIcon>
            <span>Switch to {theme === 'dark' ? 'light' : 'dark'} theme</span>
          </Command.Item>
          <Command.Item
            value="open indexer admin"
            keywords={['settings', 'configuration', 'legacy', 'trackers']}
            onSelect={() => closeThen(onOpenAdmin)}
            className={itemClassName}
          >
            <ItemIcon><ServerCog className="size-4" /></ItemIcon>
            <span>Open indexer admin</span>
          </Command.Item>
        </Command.Group>

        {recentSearches.length ? (
          <Command.Group heading="History" className="command-group">
            <Command.Item
              value="clear recent search history"
              keywords={['remove', 'delete', 'recents']}
              onSelect={() => closeThen(onClearRecentSearches)}
              className={itemClassName}
            >
              <ItemIcon destructive><Trash2 className="size-4" /></ItemIcon>
              <span>Clear recent searches</span>
            </Command.Item>
          </Command.Group>
        ) : null}
      </Command.List>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/25 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-500" /> Ready</span>
        <div className="flex items-center gap-3">
          <span><kbd className="font-sans">↑↓</kbd> navigate</span>
          <span><kbd className="font-sans">↵</kbd> select</span>
          <span className="hidden sm:inline"><kbd className="font-sans">esc</kbd> close</span>
        </div>
      </div>
    </Command.Dialog>
  )
}

import { useMemo, useState } from 'react'
import { Check, Filter, Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Capability, JackettIndexer } from '@/types/jackett'

interface SearchFiltersProps {
  indexers: JackettIndexer[]
  selectedIndexerIds: Set<string>
  onIndexerIdsChange: (ids: Set<string>) => void
  categories: Capability[]
  selectedCategoryIds: Set<string>
  onCategoryIdsChange: (ids: Set<string>) => void
}

export function SearchFilters({
  indexers,
  selectedIndexerIds,
  onIndexerIdsChange,
  categories,
  selectedCategoryIds,
  onCategoryIdsChange,
}: SearchFiltersProps) {
  const [filter, setFilter] = useState('')
  const visibleIndexers = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return needle
      ? indexers.filter((indexer) => `${indexer.name} ${indexer.tags.join(' ')}`.toLowerCase().includes(needle))
      : indexers
  }, [filter, indexers])

  function toggleIndexer(id: string) {
    const next = new Set(selectedIndexerIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onIndexerIdsChange(next)
  }

  function toggleCategory(id: string) {
    const next = new Set(selectedCategoryIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onCategoryIdsChange(next)
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-10 bg-background/45">
          <Filter />
          Refine
          {(selectedIndexerIds.size !== indexers.length || selectedCategoryIds.size > 0) ? (
            <Badge variant="secondary" className="ml-1 px-1.5 text-[10px]">
              {selectedIndexerIds.size} · {selectedCategoryIds.size || 'any'}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col border-l bg-background/95 p-0 backdrop-blur-xl sm:max-w-md">
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle>Search scope</SheetTitle>
          <SheetDescription>Choose exactly where this search should run.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 p-5">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Indexers</h3>
                  <p className="text-xs text-muted-foreground">{selectedIndexerIds.size} of {indexers.length} selected</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onIndexerIdsChange(new Set(indexers.map((indexer) => indexer.id)))}><Check /> All</Button>
                  <Button variant="ghost" size="sm" onClick={() => onIndexerIdsChange(new Set())}><X /> None</Button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter indexers…" className="pl-9" />
              </div>
              <div className="space-y-1">
                {visibleIndexers.map((indexer) => (
                  <label key={indexer.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/60">
                    <Checkbox checked={selectedIndexerIds.has(indexer.id)} onCheckedChange={() => toggleIndexer(indexer.id)} />
                    <span className="min-w-0 flex-1 truncate text-sm">{indexer.name}</span>
                    <span className={cn('size-1.5 rounded-full', indexer.last_error ? 'bg-amber-500' : 'bg-emerald-500')} />
                    <Badge variant="outline" className="font-normal capitalize">{indexer.type}</Badge>
                  </label>
                ))}
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Categories</h3>
                  <p className="text-xs text-muted-foreground">No selection searches every category.</p>
                </div>
                {selectedCategoryIds.size ? <Button variant="ghost" size="sm" onClick={() => onCategoryIdsChange(new Set())}>Clear</Button> : null}
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {categories.map((category) => (
                  <label key={category.ID} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-accent/60">
                    <Checkbox checked={selectedCategoryIds.has(category.ID)} onCheckedChange={() => toggleCategory(category.ID)} />
                    <span className="min-w-0 truncate text-sm">{category.Name}</span>
                  </label>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

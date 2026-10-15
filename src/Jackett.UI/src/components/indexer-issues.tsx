import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  Clipboard,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Wrench,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { deleteIndexer, getIndexerConfig, testIndexer, updateIndexerConfig } from '@/lib/api'
import { diagnoseIndexerIssue } from '@/lib/indexer-diagnostics'
import { cn } from '@/lib/utils'
import type { IndexerConfigItem, IndexerConfigUpdate, IndexerProgress, JackettIndexer } from '@/types/jackett'

type TestState = { state: 'idle' | 'testing' | 'success' | 'error'; message?: string }

function cleanInfo(value: string) {
  return value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
}

function ConfigField({
  item,
  onChange,
}: {
  item: IndexerConfigItem
  onChange: (next: IndexerConfigItem) => void
}) {
  if (item.type === 'displayinfo') {
    return <div className="whitespace-pre-line rounded-xl border border-primary/15 bg-primary/6 p-3 text-xs leading-5 text-muted-foreground">{cleanInfo(String(item.value || ''))}</div>
  }

  if (item.type === 'displayimage') {
    return item.value ? <img src={String(item.value)} alt={item.name} className="max-h-48 rounded-xl border object-contain" /> : null
  }

  if (item.type === 'hiddendata') return null

  if (item.type === 'inputbool') {
    return (
      <label className="flex items-center justify-between gap-4 rounded-xl border bg-background/45 px-3 py-3">
        <span className="text-sm font-medium">{item.name}</span>
        <Switch checked={Boolean(item.value)} onCheckedChange={(checked) => onChange({ ...item, value: checked })} />
      </label>
    )
  }

  if (item.type === 'inputselect') {
    return (
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{item.name}</span>
        <select
          value={String(item.value || '')}
          onChange={(event) => onChange({ ...item, value: event.target.value })}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {Object.entries(item.options || {}).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    )
  }

  if (item.type === 'inputcheckbox') {
    const selected = new Set(item.values || [])
    return (
      <fieldset className="space-y-2 rounded-xl border bg-background/35 p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">{item.name}</legend>
        {Object.entries(item.options || {}).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.has(value)}
              onCheckedChange={(checked) => {
                const next = new Set(selected)
                if (checked) next.add(value)
                else next.delete(value)
                onChange({ ...item, values: [...next] })
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>
    )
  }

  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{item.name}</span>
      <Input
        type={item.type === 'password' || item.name.toLocaleLowerCase() === 'password' ? 'password' : 'text'}
        value={String(item.value ?? '')}
        onChange={(event) => onChange({ ...item, value: event.target.value })}
        pattern={item.pattern}
        className="bg-background/65"
      />
    </label>
  )
}

export function IndexerIssues({
  open,
  onOpenChange,
  issues,
  selectedIssueId,
  onSelectedIssueIdChange,
  indexers,
  searchQuery,
  onRetrySearch,
  onRemoved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  issues: IndexerProgress[]
  selectedIssueId: string | null
  onSelectedIssueIdChange: (id: string) => void
  indexers: JackettIndexer[]
  searchQuery?: string
  onRetrySearch: (indexerId: string) => void
  onRemoved: (indexerId: string) => void
}) {
  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) || issues[0]
  const selectedIndexer = indexers.find((indexer) => indexer.id === selectedIssue?.id)
  const [view, setView] = useState<'diagnosis' | 'configuration'>('diagnosis')
  const [draft, setDraft] = useState<IndexerConfigItem[]>([])
  const [testState, setTestState] = useState<TestState>({ state: 'idle' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const config = useQuery({
    queryKey: ['indexer-config', selectedIssue?.id],
    queryFn: ({ signal }) => getIndexerConfig(selectedIssue!.id, signal),
    enabled: open && Boolean(selectedIssue),
    retry: false,
  })

  useEffect(() => {
    if (config.data) setDraft(config.data.map((item) => ({ ...item, values: item.values ? [...item.values] : undefined })))
  }, [config.data])

  useEffect(() => {
    setDraft([])
    setView('diagnosis')
    setTestState({ state: 'idle' })
    setConfirmDelete(false)
  }, [selectedIssue?.id])

  const diagnosis = useMemo(
    () => selectedIssue ? diagnoseIndexerIssue(selectedIssue) : null,
    [selectedIssue],
  )

  async function runTest() {
    if (!selectedIssue) return
    setTestState({ state: 'testing' })
    try {
      await testIndexer(selectedIssue.id)
      setTestState({ state: 'success', message: 'Connection test passed. Retry the search to confirm results.' })
    } catch (error) {
      setTestState({ state: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  async function saveConfiguration() {
    if (!selectedIssue) return
    setSaving(true)
    setTestState({ state: 'idle' })
    const payload: IndexerConfigUpdate[] = draft
      .filter((item) => !['displayinfo', 'displayimage'].includes(item.type))
      .map((item) => ({ id: item.id, value: item.value, values: item.values }))
    try {
      await updateIndexerConfig(selectedIssue.id, payload)
      await config.refetch()
      setTestState({ state: 'success', message: 'Configuration saved successfully.' })
      setView('diagnosis')
    } catch (error) {
      setTestState({ state: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setSaving(false)
    }
  }

  async function removeIndexer() {
    if (!selectedIssue) return
    setDeleting(true)
    try {
      await deleteIndexer(selectedIssue.id)
      onRemoved(selectedIssue.id)
      setConfirmDelete(false)
      if (issues.length <= 1) onOpenChange(false)
    } catch (error) {
      setTestState({ state: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-5 pr-12">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500"><Wrench className="size-4" /></span>
            <div>
              <SheetTitle>Indexer issues</SheetTitle>
              <SheetDescription>Investigate, test, reconfigure, or remove a failing tracker.</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {issues.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-b px-4 py-3 [scrollbar-width:none]">
            {issues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => onSelectedIssueIdChange(issue.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                  selectedIssue?.id === issue.id ? 'border-amber-500/35 bg-amber-500/10 text-amber-500' : 'bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                <AlertTriangle className="size-3.5" /> {issue.name}
              </button>
            ))}
          </div>
        ) : null}

        {!selectedIssue || !diagnosis ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">No issues in this search.</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex border-b px-4 pt-3">
              {(['diagnosis', 'configuration'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setView(tab)}
                  className={cn('border-b-2 px-3 py-2 text-sm capitalize text-muted-foreground transition-colors', view === tab ? 'border-primary text-foreground' : 'border-transparent hover:text-foreground')}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {view === 'diagnosis' ? (
                <div className="space-y-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold tracking-tight">{selectedIssue.name}</h3>
                      <Badge variant="outline" className="border-amber-500/25 bg-amber-500/8 text-amber-500">{selectedIssue.state === 'timed-out' ? 'Timed out' : 'Failed'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedIssue.elapsedMs ? `${(selectedIssue.elapsedMs / 1000).toFixed(1)}s` : 'No timing'}
                      {searchQuery ? ` · while searching “${searchQuery}”` : ''}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/7 p-4">
                    <p className="font-medium text-amber-600 dark:text-amber-400">{diagnosis.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{diagnosis.description}</p>
                    <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                      {diagnosis.suggestions.map((suggestion) => <li key={suggestion} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-amber-500" />{suggestion}</li>)}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Complete error</p>
                      {selectedIssue.error ? <Button variant="ghost" size="sm" className="h-7" onClick={() => void navigator.clipboard.writeText(selectedIssue.error!)}><Clipboard /> Copy</Button> : null}
                    </div>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/35 p-3 font-mono text-[11px] leading-5 text-muted-foreground">{selectedIssue.error || 'The indexer exceeded the per-request timeout.'}</pre>
                  </div>

                  {testState.state !== 'idle' ? (
                    <div className={cn('rounded-xl border p-3 text-sm', testState.state === 'success' ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400' : testState.state === 'error' ? 'border-destructive/20 bg-destructive/8 text-destructive' : 'text-muted-foreground')}>
                      <div className="flex items-start gap-2">
                        {testState.state === 'testing' ? <LoaderCircle className="mt-0.5 size-4 animate-spin" /> : testState.state === 'success' ? <Check className="mt-0.5 size-4" /> : <AlertTriangle className="mt-0.5 size-4" />}
                        <span>{testState.state === 'testing' ? 'Testing the tracker connection…' : testState.message}</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => void runTest()} disabled={testState.state === 'testing'}><RefreshCw className={testState.state === 'testing' ? 'animate-spin' : ''} /> Test connection</Button>
                    <Button variant="secondary" onClick={() => onRetrySearch(selectedIssue.id)} disabled={!selectedIndexer}><RotateCcw /> Retry search</Button>
                    <Button variant="outline" onClick={() => setView('configuration')}><Settings2 /> Edit configuration</Button>
                    {selectedIndexer?.site_link ? <Button asChild variant="outline"><a href={selectedIndexer.site_link} target="_blank" rel="noreferrer"><ExternalLink /> Open tracker</a></Button> : null}
                  </div>

                  <Separator />

                  {!confirmDelete ? (
                    <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Remove this indexer</Button>
                  ) : (
                    <div className="rounded-xl border border-destructive/25 bg-destructive/7 p-4">
                      <p className="text-sm font-medium text-destructive">Remove {selectedIssue.name} from Jackett?</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">This deletes its saved configuration. You can add and configure it again later.</p>
                      <div className="mt-3 flex gap-2">
                        <Button variant="destructive" size="sm" disabled={deleting} onClick={() => void removeIndexer()}>{deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />} Confirm removal</Button>
                        <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Keep indexer</Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold">Configure {selectedIssue.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Saved passwords stay masked. Saving uses Jackett’s existing configuration validation.</p>
                  </div>
                  {config.isPending ? <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : null}
                  {config.isError ? <div className="rounded-xl border border-destructive/20 bg-destructive/8 p-3 text-sm text-destructive">{config.error instanceof Error ? config.error.message : 'Configuration could not be loaded.'}</div> : null}
                  {draft.map((item, index) => (
                    <ConfigField key={item.id} item={item} onChange={(next) => setDraft((current) => current.map((entry, entryIndex) => entryIndex === index ? next : entry))} />
                  ))}
                  <div className="sticky bottom-0 -mx-5 flex gap-2 border-t bg-background/92 px-5 py-4 backdrop-blur-xl">
                    <Button className="flex-1" disabled={saving || !draft.length} onClick={() => void saveConfiguration()}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />} Save configuration</Button>
                    <Button variant="outline" onClick={() => setView('diagnosis')}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

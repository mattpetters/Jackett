import { Ban, CheckCircle2, History, LoaderCircle, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { SearchSession } from '@/types/jackett'

function sessionProgress(session: SearchSession) {
  return session.progress.filter((item) => !['queued', 'searching'].includes(item.state)).length
}

function SessionIcon({ status }: { status: SearchSession['status'] }) {
  if (status === 'searching') return <LoaderCircle className="size-3.5 animate-spin text-primary" />
  if (status === 'cancelled') return <Ban className="size-3.5 text-muted-foreground" />
  return <CheckCircle2 className="size-3.5 text-emerald-500" />
}

export function SearchSessions({
  sessions,
  activeSessionId,
  onSelect,
  onCancel,
  onRemove,
  onClearSettled,
}: {
  sessions: SearchSession[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onClearSettled: () => void
}) {
  if (!sessions.length) return null

  const runningCount = sessions.filter((session) => session.status === 'searching').length
  const settledCount = sessions.length - runningCount

  return (
    <section aria-label="Search sessions" className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <History className="size-3.5" /> Search sessions
          {runningCount ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
              {runningCount} running
            </span>
          ) : null}
        </div>
        {settledCount ? (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={onClearSettled}>
            Clear settled
          </Button>
        ) : null}
      </div>

      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
        {sessions.map((session) => {
          const active = session.id === activeSessionId
          const completed = sessionProgress(session)
          return (
            <div
              key={session.id}
              className={cn(
                'group flex min-w-[15rem] max-w-[20rem] snap-start items-stretch overflow-hidden rounded-xl border bg-card/55 transition-colors',
                active ? 'border-primary/40 bg-primary/7 shadow-sm shadow-primary/10' : 'hover:border-foreground/15 hover:bg-card/80',
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onSelect(session.id)}
                aria-pressed={active}
              >
                <span className="flex items-center gap-2">
                  <SessionIcon status={session.status} />
                  <span className="truncate text-sm font-medium">{session.query}</span>
                </span>
                <span className="mt-1 flex items-center gap-1.5 pl-5.5 text-[11px] text-muted-foreground">
                  <span>{session.results.length.toLocaleString()} results</span>
                  <span>·</span>
                  <span>{completed}/{session.indexerCount} indexers</span>
                </span>
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex w-9 shrink-0 items-center justify-center border-l text-muted-foreground opacity-65 outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring group-hover:opacity-100"
                    onClick={() => session.status === 'searching' ? onCancel(session.id) : onRemove(session.id)}
                    aria-label={session.status === 'searching' ? `Cancel ${session.query}` : `Remove ${session.query}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{session.status === 'searching' ? 'Cancel this search' : 'Remove from this session'}</TooltipContent>
              </Tooltip>
            </div>
          )
        })}
      </div>
    </section>
  )
}

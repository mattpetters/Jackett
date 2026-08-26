import { AlertTriangle, Check, Clock3, LoaderCircle, X } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { IndexerProgress } from '@/types/jackett'

const stateIcon = {
  queued: Clock3,
  searching: LoaderCircle,
  complete: Check,
  failed: AlertTriangle,
  'timed-out': Clock3,
  cancelled: X,
}

export function TrackerProgress({ items }: { items: IndexerProgress[] }) {
  if (!items.length) return null
  const settled = items.filter((item) => !['queued', 'searching'].includes(item.state)).length
  const completed = items.filter((item) => item.state === 'complete').length

  return (
    <div className="glass-panel overflow-hidden rounded-xl">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="text-sm font-medium">Indexer pulse</p>
          <p className="text-xs text-muted-foreground">{completed} responded · {settled} of {items.length} settled</p>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{Math.round((settled / items.length) * 100)}%</span>
      </div>
      <Progress value={(settled / items.length) * 100} className="h-0.5 rounded-none" />
      <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const Icon = stateIcon[item.state]
          return (
            <div
              key={item.id}
              title={item.error}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg border bg-background/45 px-2.5 py-1.5 text-xs transition-colors',
                item.state === 'searching' && 'border-primary/35 bg-primary/8 text-primary',
                item.state === 'complete' && 'border-emerald-500/20 text-emerald-500',
                (item.state === 'failed' || item.state === 'timed-out') && 'border-amber-500/20 text-amber-500',
                item.state === 'cancelled' && 'opacity-50',
              )}
            >
              <Icon className={cn('size-3.5', item.state === 'searching' && 'animate-spin')} />
              <span className="max-w-32 truncate text-foreground">{item.name}</span>
              {item.state === 'complete' ? <span className="tabular-nums">{item.resultCount}</span> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

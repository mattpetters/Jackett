import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Check,
  Columns3,
  Copy,
  Download,
  ExternalLink,
  Flame,
  Magnet,
} from 'lucide-react'

import { DataTable } from '@/components/tables/data-table/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MagnifyingGlassIcon } from '@/components/ui/icons/magnifying-glass'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SearchResult } from '@/types/jackett'

function formatBytes(bytes?: number) {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exponent).toFixed(exponent > 2 ? 2 : 1)} ${units[exponent]}`
}

function formatAge(value: string) {
  const milliseconds = Date.now() - Date.parse(value)
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 60) return `${days}d`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
}

export function ResultsTable({ results, searching }: { results: SearchResult[]; searching: boolean }) {
  const columns = useMemo<ColumnDef<SearchResult>[]>(
    () => [
      {
        accessorKey: 'Title',
        header: 'Release',
        cell: ({ row }) => {
          const release = row.original
          const freeleech = release.DownloadVolumeFactor === 0
          return (
            <div className="min-w-[18rem] max-w-[46rem]">
              <div className="flex items-start gap-2">
                {freeleech ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/12 text-emerald-500">
                        <Flame className="size-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Freeleech</TooltipContent>
                  </Tooltip>
                ) : null}
                <div className="min-w-0">
                  {release.Details ? (
                    <a
                      href={release.Details}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 break-words font-medium leading-5 text-foreground decoration-primary/50 underline-offset-4 hover:text-primary hover:underline"
                    >
                      {release.Title}
                    </a>
                  ) : (
                    <span className="line-clamp-2 break-words font-medium leading-5">{release.Title}</span>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground sm:hidden">
                    <span>{release.Tracker}</span><span>·</span><span>{formatBytes(release.Size)}</span><span>·</span><span>{formatAge(release.PublishDate)}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        },
        sortingFn: 'alphanumeric',
      },
      {
        accessorKey: 'Tracker',
        header: 'Indexer',
        cell: ({ getValue }) => <Badge variant="secondary" className="max-w-40 truncate font-normal">{String(getValue())}</Badge>,
        meta: { className: 'hidden sm:table-cell' },
      },
      {
        accessorKey: 'PublishDate',
        header: 'Age',
        cell: ({ getValue }) => <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatAge(String(getValue()))}</span>,
        sortingFn: 'datetime',
        meta: { className: 'hidden md:table-cell' },
      },
      {
        accessorKey: 'Size',
        header: 'Size',
        cell: ({ getValue }) => <span className="whitespace-nowrap tabular-nums">{formatBytes(Number(getValue()))}</span>,
        meta: { className: 'hidden lg:table-cell' },
      },
      {
        accessorKey: 'CategoryDesc',
        header: 'Category',
        cell: ({ getValue }) => <span className="line-clamp-1 max-w-36 text-xs text-muted-foreground">{String(getValue() || 'Other')}</span>,
        meta: { className: 'hidden xl:table-cell' },
      },
      {
        accessorKey: 'Seeders',
        header: 'Seeds',
        cell: ({ getValue }) => {
          const seeds = Number(getValue() || 0)
          return <span className={seeds > 0 ? 'font-medium tabular-nums text-emerald-500' : 'tabular-nums text-muted-foreground'}>{seeds}</span>
        },
        meta: { className: 'hidden md:table-cell' },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const release = row.original
          const primaryDownload = release.Link || release.MagnetUri
          return (
            <div className="flex justify-end gap-1">
              {release.MagnetUri ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 opacity-70 hover:opacity-100" onClick={() => void copyText(release.MagnetUri!)} aria-label="Copy magnet link">
                      <Copy />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy magnet</TooltipContent>
                </Tooltip>
              ) : null}
              {primaryDownload ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="ghost" size="icon" className="size-8 text-primary opacity-80 hover:opacity-100">
                      <a href={primaryDownload} aria-label="Download release">
                        {release.MagnetUri && !release.Link ? <Magnet /> : <Download />}
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download</TooltipContent>
                </Tooltip>
              ) : release.Details ? (
                <Button asChild variant="ghost" size="icon" className="size-8">
                  <a href={release.Details} target="_blank" rel="noreferrer" aria-label="Open release details"><ExternalLink /></a>
                </Button>
              ) : null}
            </div>
          )
        },
      },
    ],
    [],
  )

  return (
    <TooltipProvider delayDuration={350}>
      <DataTable
        columns={columns}
        data={results}
        getRowId={(row) => `${row.TrackerId}:${row.InfoHash || row.Guid || row.Title}`}
        initialSorting={[{ id: 'PublishDate', desc: true }]}
        emptyState={
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
            <div className="flex size-12 items-center justify-center rounded-2xl border bg-muted/45 text-muted-foreground">
              {searching ? <MagnifyingGlassIcon size={24} /> : <Check className="size-5" />}
            </div>
            <div>
              <p className="font-medium">{searching ? 'Listening for indexers…' : 'Ready when you are'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {searching ? 'Results will land here as each indexer responds.' : 'Search every configured tracker without leaving the dashboard.'}
              </p>
            </div>
          </div>
        }
        toolbar={(table) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 bg-background/50">
                <Columns3 /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllColumns().filter((column) => column.getCanHide()).map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                  className="capitalize"
                >
                  {column.id === 'PublishDate' ? 'Age' : column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </TooltipProvider>
  )
}

'use client'

// Client island for the invoices list. URL-DRIVEN: the Server Component
// (`invoices/page.tsx`) reads `searchParams`, fetches the matching page via
// `getInvoicesPage`, and passes it down. This island only MUTATES the URL
// (search, saved-view tab, page, sort) through `useListUrlState` — it never
// filters in-browser, so reloads / back-forward / shared links all reproduce
// the same view.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusPill, statusTone } from '@/components/ui/status-pill'
import { Money } from '@/components/ui/money'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import type { Column } from '@/lib/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { FilterChips, type FilterChip } from '@/components/ui/filter-chips'
import { listViewState } from '@/lib/list-view-state'
import { paymentStatusLabel } from '@/lib/status-badge'
import { FileText, Plus, Search } from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { isVoided } from '@chidental/shared'
import { useListUrlState, type ListUrlState } from '@/lib/use-list-url-state'
import { useAuth } from '@/contexts/AuthContext'
import type { InvoiceListRow, InvoiceListPage, InvoiceView } from '@/data/invoices'

const VIEWS: { key: InvoiceView; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'unpaid', label: 'Awaiting payment' },
  { key: 'voided', label: 'Voided' },
]

export function InvoiceListClient({
  page,
  counts,
  state,
}: {
  page: InvoiceListPage
  counts: Record<InvoiceView, number>
  state: ListUrlState
}) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const { search, setSearch, setView, setPage, toggleSort, sort, clearSearch, clearView } =
    useListUrlState(state, 'all')

  const viewKey = state.view as InvoiceView
  const rows = page.rows

  const columns: Column<InvoiceListRow>[] = [
    { key: 'number', header: 'Invoice #', sortKey: 'number', cell: inv => <span className="font-medium text-brand">{inv.invoice_number}</span> },
    { key: 'customer', header: 'Clinic', sortKey: 'customer', cell: inv => <span className="text-muted-foreground">{inv.customers?.clinic_name ?? '—'}</span> },
    { key: 'patient', header: 'Patient', sortKey: 'patient', cell: inv => <span className="text-muted-foreground">{inv.patient ?? '—'}</span> },
    { key: 'date', header: 'Date', sortKey: 'date', cell: inv => <span className="text-sm text-muted-foreground">{formatDate(inv.invoice_date)}</span> },
    { key: 'amount', header: 'Amount', align: 'right', sortKey: 'amount', cell: inv => <Money className="font-medium">{formatCurrency(inv.total)}</Money> },
    {
      key: 'payment',
      header: 'Payment',
      cell: inv =>
        isVoided(inv) ? (
          <StatusPill tone="danger" className="uppercase">Voided</StatusPill>
        ) : (
          <StatusPill tone={statusTone('payment', inv.status)}>{paymentStatusLabel(inv.status)}</StatusPill>
        ),
    },
  ]

  const hasQuery = state.q.trim() !== '' || viewKey !== 'all'
  const viewState = listViewState({ loading: false, total: counts.all, filtered: page.total, hasQuery })
  const activeViewLabel = VIEWS.find(v => v.key === viewKey)?.label ?? 'All'

  // Removable chips for the active search / non-default view.
  const chips: FilterChip[] = []
  if (viewKey !== 'all') chips.push({ key: 'view', label: `View: ${activeViewLabel}`, onRemove: clearView })
  if (state.q.trim() !== '') chips.push({ key: 'search', label: `Search: ${state.q.trim()}`, onRemove: clearSearch })

  const emptyState = (
    <EmptyState
      icon={<FileText className="h-8 w-8" />}
      title={viewState === 'empty-no-results' ? `No invoices in "${activeViewLabel}"` : 'No invoices yet'}
      description={viewState === 'empty-no-results' ? 'Try a different search or view.' : 'Create your first invoice to get started.'}
    />
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle={`${counts.all} total`}
        actions={
          hasPermission('invoices.create') ? (
            <Button className="w-full sm:w-auto" asChild>
              <Link href="/invoices/new"><Plus className="h-4 w-4 mr-2" />New Invoice</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <div role="tablist" aria-label="Invoice views" className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
            {VIEWS.map(v => {
              const active = v.key === viewKey
              return (
                <button
                  key={v.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(v.key)}
                  className={cn(
                    'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v.label}
                  <span className={cn('ml-1.5 text-xs tabular-nums', active ? 'text-muted-foreground' : 'text-muted-foreground/60')}>{counts[v.key]}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoice #, clinic, or patient…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <FilterChips chips={chips} />
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={inv => inv.id}
            onRowClick={inv => router.push(`/invoices/${inv.id}`)}
            empty={emptyState}
            sort={sort}
            onSort={toggleSort}
            footer={
              <Pagination
                page={page.page}
                totalPages={page.totalPages}
                filteredCount={page.total}
                pageStart={page.pageStart}
                pageEnd={page.pageEnd}
                onPageChange={setPage}
                itemLabel="invoices"
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}

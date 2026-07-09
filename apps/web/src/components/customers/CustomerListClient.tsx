'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import type { Column } from '@/lib/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { FilterChips, type FilterChip } from '@/components/ui/filter-chips'
import { ListToolbar } from '@/components/ui/list-toolbar'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { listViewState } from '@/lib/list-view-state'
import { Plus, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useListUrlState, type ListUrlState } from '@/lib/use-list-url-state'
import type { Customer } from '@chidental/shared'
import type { CustomerListPage, CustomerView } from '@/data/customers'
import { useAuth } from '@/contexts/AuthContext'

const VIEW_LABELS: Record<CustomerView, string> = {
  active: 'Active only',
  archived: 'Archived only',
  all: 'All',
}

// Client island for the clinics list. URL-DRIVEN: the Server Component
// (`customers/page.tsx`) reads `searchParams`, fetches the page via
// `getCustomersPage` (server-side active/archived filter + search + sort +
// pagination), and passes it in; this island only mutates the URL state via
// `useListUrlState`. The active/archived choice rides the shared `view` slot —
// same pattern as the products catalogue.
export function CustomerListClient({ page, state }: { page: CustomerListPage; state: ListUrlState }) {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const { search, setSearch, setView, setPage, toggleSort, sort, clearSearch, clearView } =
    useListUrlState(state, 'active')

  const activeFilter = (['active', 'archived', 'all'].includes(state.view) ? state.view : 'active') as CustomerView

  const columns: Column<Customer>[] = [
    { key: 'clinic', header: 'Clinic', sortKey: 'clinic', cell: c => <span className="font-medium text-foreground">{c.clinic_name}</span> },
    { key: 'contact', header: 'Contact Person', sortKey: 'contact', cell: c => <span className="text-muted-foreground">{c.contact_person ?? '—'}</span> },
    { key: 'phone', header: 'Phone', cell: c => <span className="text-muted-foreground">{c.phone ?? '—'}</span> },
    { key: 'email', header: 'Email', cell: c => <span className="text-muted-foreground">{c.email ?? '—'}</span> },
    { key: 'registered', header: 'Registered', sortKey: 'registered', cell: c => <span className="text-sm text-muted-foreground">{formatDate(c.created_at)}</span> },
  ]
  // Status column only earns its place once archived rows can appear in the list;
  // in the default (active-only) view every row would read "Active", so we omit it.
  if (activeFilter !== 'active') {
    columns.push({
      key: 'status',
      header: 'Status',
      cell: c => <Badge variant={c.archived_at ? 'secondary' : 'success'}>{c.archived_at ? 'Archived' : 'Active'}</Badge>,
    })
  }

  const view = listViewState({
    loading: false,
    total: page.total,
    filtered: page.total,
    hasQuery: state.q.trim() !== '' || activeFilter !== 'active',
  })

  const chips: FilterChip[] = []
  if (activeFilter !== 'active') chips.push({ key: 'view', label: `Filter: ${VIEW_LABELS[activeFilter]}`, onRemove: clearView })
  if (state.q.trim() !== '') chips.push({ key: 'search', label: `Search: ${state.q.trim()}`, onRemove: clearSearch })

  const countNoun = activeFilter === 'archived' ? 'archived' : activeFilter === 'all' ? 'total' : 'registered'

  const emptyState = (
    <EmptyState
      icon={<Users className="h-8 w-8" />}
      title={
        activeFilter === 'archived'
          ? 'No archived clinics'
          : view === 'empty-no-results'
            ? 'No clinics match your search'
            : 'No clinics yet'
      }
      description={
        activeFilter === 'archived'
          ? 'Clinics you archive will appear here.'
          : view === 'empty-no-results'
            ? 'Try a different search term.'
            : 'Add your first clinic to get started.'
      }
    />
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Clinics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{page.total} {countNoun}</p>
        </div>
        {hasPermission('customers.edit') && (
          <Button className="w-full sm:w-auto" asChild>
            <Link href="/customers/new"><Plus className="h-4 w-4 mr-2" />New Clinic</Link>
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <ListToolbar value={search} onChange={setSearch} placeholder="Search clinic, contact person or phone…">
          <Select value={activeFilter} onValueChange={v => setView(v as CustomerView)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="archived">Archived only</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </ListToolbar>

        <FilterChips chips={chips} />
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            rows={page.rows}
            rowKey={c => c.id}
            rowClassName={c => (c.archived_at ? 'opacity-50' : '')}
            onRowClick={c => router.push(`/customers/${c.id}`)}
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
                itemLabel="clinics"
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}

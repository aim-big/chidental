'use client'

// IMPECCABLE REDESIGN DEMO — Service (route: /products). The lab's price catalog.
// Search + Active/Inactive/All + category filter. Category grouping is a redesign
// enhancement (the live catalog has no category field yet). Mock data.

import { useMemo, useState } from 'react'
import { Plus, Package, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, Panel, SearchInput, Segmented, StatusPill, DataTable, EmptyState, Money, type Col } from '../_components/kit'
import { SERVICES, rm, type Service, type ServiceCategory } from '../_lib/mock'

type View = 'active' | 'inactive' | 'all'
const CATEGORIES: (ServiceCategory | 'All')[] = ['All', 'Crown & Bridge', 'Implant', 'Removable', 'Appliance', 'Misc']

export default function DemoService() {
  const [view, setView] = useState<View>('active')
  const [cat, setCat] = useState<ServiceCategory | 'All'>('All')
  const [q, setQ] = useState('')

  const counts = useMemo(() => ({
    active: SERVICES.filter((s) => s.active).length,
    inactive: SERVICES.filter((s) => !s.active).length,
    all: SERVICES.length,
  }), [])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return SERVICES.filter((s) => {
      if (view === 'active' && !s.active) return false
      if (view === 'inactive' && s.active) return false
      if (cat !== 'All' && s.category !== cat) return false
      if (!term) return true
      return [s.name, s.description, s.category].some((f) => f.toLowerCase().includes(term))
    })
  }, [view, cat, q])

  const priceCell = (s: Service) =>
    s.priceMax != null
      ? <span className="font-medium tabular-nums">{rm(s.price)} – {rm(s.priceMax)}</span>
      : <Money value={s.price} className="font-medium" />

  const columns: Col<Service>[] = [
    {
      key: 'name', header: 'Service',
      cell: (s) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{s.name}</p>
          <p className="truncate text-xs text-muted-foreground">{s.description}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', cell: (s) => <StatusPill tone="brand">{s.category}</StatusPill> },
    { key: 'unit', header: 'Unit', cell: (s) => <span className="text-muted-foreground">per {s.unit}</span> },
    { key: 'jobs', header: 'Jobs · Jul', align: 'right', cell: (s) => <span className="tabular-nums text-muted-foreground">{s.jobsThisMonth || '—'}</span> },
    { key: 'price', header: 'Price', align: 'right', cell: priceCell },
    { key: 'status', header: 'Status', align: 'right', cell: (s) => <StatusPill tone={s.active ? 'success' : 'neutral'} dot>{s.active ? 'Active' : 'Inactive'}</StatusPill> },
    {
      key: 'actions', header: '', align: 'right',
      cell: () => (
        <button className="inline-grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary" title="Edit service">
          <PencilLine className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Service"
        subtitle="Price catalog for invoicing"
        actions={<Button><Plus className="mr-2 h-4 w-4" /> New service</Button>}
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={q} onChange={setQ} placeholder="Search service or category…" className="sm:max-w-xs" />
          <Segmented
            value={view}
            onChange={(v) => setView(v as View)}
            options={[
              { value: 'active', label: 'Active', count: counts.active },
              { value: 'inactive', label: 'Inactive', count: counts.inactive },
              { value: 'all', label: 'All', count: counts.all },
            ]}
          />
        </div>
        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = c === cat
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                  (active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground')
                }
              >
                {c}
              </button>
            )
          })}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        rowClassName={(s) => (s.active ? '' : 'opacity-60')}
        empty={<EmptyState icon={<Package className="h-5 w-5" />} title="No services match" hint="Try a different search, status, or category." />}
        footer={<p className="text-xs text-muted-foreground">Showing {rows.length} of {counts.all} services</p>}
      />
    </div>
  )
}

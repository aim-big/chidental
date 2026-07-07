'use client'

// IMPECCABLE REDESIGN DEMO — Clinics (code: customers). List with a summary band,
// search, and an Active/Archived/All view filter. Mock data; originals untouched.

import { useMemo, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, Panel, SearchInput, Segmented, StatusPill, DataTable, EmptyState, Money, Avatar, type Col } from '../_components/kit'
import { CLINICS, shortDate, type Clinic } from '../_lib/mock'

type View = 'active' | 'archived' | 'all'

export default function DemoClinics() {
  const [view, setView] = useState<View>('active')
  const [q, setQ] = useState('')

  const counts = useMemo(() => ({
    active: CLINICS.filter((c) => c.status === 'active').length,
    archived: CLINICS.filter((c) => c.status === 'archived').length,
    all: CLINICS.length,
  }), [])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return CLINICS.filter((c) => {
      if (view !== 'all' && c.status !== view) return false
      if (!term) return true
      return [c.name, c.contact, c.phone, c.email, c.city].some((f) => f.toLowerCase().includes(term))
    })
  }, [view, q])

  const activeClinics = CLINICS.filter((c) => c.status === 'active')
  const totalOutstanding = activeClinics.reduce((s, c) => s + c.outstanding, 0)
  const openJobs = activeClinics.reduce((s, c) => s + c.openJobs, 0)

  const columns: Col<Clinic>[] = [
    {
      key: 'name', header: 'Clinic',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.city}</p>
          </div>
        </div>
      ),
    },
    { key: 'contact', header: 'Contact', cell: (c) => <span className="text-muted-foreground">{c.contact}</span> },
    { key: 'phone', header: 'Phone', cell: (c) => <span className="text-muted-foreground tabular-nums">{c.phone}</span> },
    { key: 'email', header: 'Email', cell: (c) => <span className="text-muted-foreground">{c.email}</span> },
    { key: 'registered', header: 'Registered', cell: (c) => <span className="text-muted-foreground">{shortDate(c.registered)}</span> },
    {
      key: 'outstanding', header: 'Outstanding', align: 'right',
      cell: (c) => c.outstanding > 0
        ? <Money value={c.outstanding} className="font-medium" />
        : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'status', header: 'Status', align: 'right',
      cell: (c) => <StatusPill tone={c.status === 'active' ? 'success' : 'neutral'} dot>{c.status === 'active' ? 'Active' : 'Archived'}</StatusPill>,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clinics"
        subtitle={`${rows.length} ${view === 'archived' ? 'archived' : view === 'all' ? 'total' : 'registered'}`}
        actions={<Button><Plus className="mr-2 h-4 w-4" /> New clinic</Button>}
      />

      {/* Summary band */}
      <Panel className="grid grid-cols-3 divide-x divide-border">
        {[
          { label: 'Active clinics', value: String(counts.active) },
          { label: 'Outstanding (active)', value: <Money value={totalOutstanding} /> },
          { label: 'Open jobs', value: String(openJobs) },
        ].map((s) => (
          <div key={s.label} className="p-5">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{s.value}</p>
          </div>
        ))}
      </Panel>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={q} onChange={setQ} placeholder="Search clinic, contact or phone…" className="sm:max-w-xs" />
        <Segmented
          value={view}
          onChange={(v) => setView(v as View)}
          options={[
            { value: 'active', label: 'Active', count: counts.active },
            { value: 'archived', label: 'Archived', count: counts.archived },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        rowClassName={(c) => (c.status === 'archived' ? 'opacity-60' : '')}
        empty={<EmptyState icon={<Users className="h-5 w-5" />} title="No clinics match your search" hint="Try a different term or view." />}
        footer={<p className="text-xs text-muted-foreground">Showing {rows.length} of {counts.all} clinics</p>}
      />
    </div>
  )
}

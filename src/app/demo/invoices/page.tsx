'use client'

// IMPECCABLE REDESIGN DEMO — Invoices. Saved-view tabs (All / Drafts / Awaiting
// payment / Voided), search, and a compact money summary. Mock data.

import { useMemo, useState } from 'react'
import { Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, Panel, SearchInput, Segmented, StatusPill, DataTable, EmptyState, Money, type Col } from '../_components/kit'
import { INVOICES, INVOICE_STATUS, shortDate, type Invoice } from '../_lib/mock'

type Tab = 'all' | 'drafts' | 'awaiting' | 'voided'
const AWAITING = new Set(['issued', 'partial', 'overdue'])

export default function DemoInvoices() {
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')

  const inTab = (i: Invoice, t: Tab) =>
    t === 'all' ? i.status !== 'voided'
      : t === 'drafts' ? i.status === 'draft'
      : t === 'awaiting' ? AWAITING.has(i.status)
      : i.status === 'voided'

  const counts = useMemo(() => ({
    all: INVOICES.filter((i) => inTab(i, 'all')).length,
    drafts: INVOICES.filter((i) => inTab(i, 'drafts')).length,
    awaiting: INVOICES.filter((i) => inTab(i, 'awaiting')).length,
    voided: INVOICES.filter((i) => inTab(i, 'voided')).length,
  }), [])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return INVOICES.filter((i) => inTab(i, tab) && (!term || [i.number, i.clinic, i.patient].some((f) => f.toLowerCase().includes(term))))
  }, [tab, q])

  const billed = INVOICES.filter((i) => i.status !== 'voided' && i.status !== 'draft').reduce((s, i) => s + i.amount, 0)
  const outstanding = INVOICES.filter((i) => AWAITING.has(i.status)).reduce((s, i) => s + (i.amount - i.paid), 0)
  const overdue = INVOICES.filter((i) => i.status === 'overdue').length

  const columns: Col<Invoice>[] = [
    { key: 'number', header: 'Invoice #', cell: (i) => <span className="font-medium text-primary">{i.number}</span> },
    {
      key: 'clinic', header: 'Clinic',
      cell: (i) => (
        <div className="min-w-0">
          <p className="truncate text-foreground">{i.clinic}</p>
          <p className="text-xs text-muted-foreground">{i.patient}</p>
        </div>
      ),
    },
    { key: 'date', header: 'Date', cell: (i) => <span className="text-muted-foreground">{shortDate(i.date)}</span> },
    { key: 'due', header: 'Due', cell: (i) => <span className="text-muted-foreground">{shortDate(i.due)}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (i) => <Money value={i.amount} className="font-medium" /> },
    {
      key: 'balance', header: 'Balance', align: 'right',
      cell: (i) => i.amount - i.paid > 0
        ? <Money value={i.amount - i.paid} className="font-medium text-foreground" />
        : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'status', header: 'Payment', align: 'right',
      cell: (i) => <StatusPill tone={INVOICE_STATUS[i.status].tone} dot={i.status !== 'voided'}>{INVOICE_STATUS[i.status].label}</StatusPill>,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        subtitle={`${counts.all} active · ${counts.drafts} drafts`}
        actions={<Button><Plus className="mr-2 h-4 w-4" /> New invoice</Button>}
      />

      {/* Money summary */}
      <Panel className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-5">
          <p className="text-xs font-medium text-muted-foreground">Billed (issued)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{<Money value={billed} />}</p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-muted-foreground">Outstanding</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700">{<Money value={outstanding} />}</p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-muted-foreground">Overdue</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-red-700">{overdue}</p>
        </div>
      </Panel>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'drafts', label: 'Drafts', count: counts.drafts },
            { value: 'awaiting', label: 'Awaiting payment', count: counts.awaiting },
            { value: 'voided', label: 'Voided', count: counts.voided },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search invoice #, clinic, or patient…" className="lg:max-w-xs" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(i) => i.id}
        rowClassName={(i) => (i.status === 'voided' ? 'opacity-60' : '')}
        empty={<EmptyState icon={<FileText className="h-5 w-5" />} title="No invoices here" hint="Try a different view or search." />}
        footer={<p className="text-xs text-muted-foreground">Showing {rows.length} invoice{rows.length === 1 ? '' : 's'}</p>}
      />
    </div>
  )
}

'use client'

// IMPECCABLE REDESIGN DEMO — Reports. Date range + three clickable metric cards
// (Total Invoiced / Collected / Outstanding) that drive the tabbed table below,
// plus By-Clinic and By-Product breakdowns with A/R aging. Mock data.

import { useMemo, useState } from 'react'
import { Printer, Download, TrendingUp, Wallet, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader, Panel, Segmented, StatusPill, DataTable, Money, Bar, BRAND, SAGE, type Col } from '../_components/kit'
import { INVOICES, PAYMENTS, SERVICES, INVOICE_STATUS, shortDate, daysOverdue, rm, type Invoice, type Payment } from '../_lib/mock'

type Tab = 'all' | 'collected' | 'outstanding' | 'clinic' | 'product'
type RangeKey = 'this-month' | 'last-month' | 'quarter' | 'ytd' | 'custom'
const RANGE_LABEL: Record<RangeKey, string> = {
  'this-month': 'This month', 'last-month': 'Last month', 'quarter': 'This quarter', 'ytd': 'Year to date', 'custom': 'Custom',
}
const AWAITING = new Set(['issued', 'partial', 'overdue'])

export default function DemoReports() {
  const [range, setRange] = useState<RangeKey>('this-month')
  const [tab, setTab] = useState<Tab>('all')

  const billedRows = useMemo(() => INVOICES.filter((i) => i.status !== 'draft' && i.status !== 'voided'), [])
  const outstandingRows = useMemo(() => INVOICES.filter((i) => AWAITING.has(i.status) && i.amount - i.paid > 0), [])

  const totalInvoiced = billedRows.reduce((s, i) => s + i.amount, 0)
  const collected = PAYMENTS.reduce((s, p) => s + p.amount, 0)
  const outstanding = outstandingRows.reduce((s, i) => s + (i.amount - i.paid), 0)

  const metrics = [
    { key: 'all' as const, label: 'Total invoiced', value: totalInvoiced, sub: `${billedRows.length} invoices`, icon: TrendingUp, tone: 'text-foreground' },
    { key: 'collected' as const, label: 'Collected', value: collected, sub: `${PAYMENTS.length} payments`, icon: Wallet, tone: 'text-green-700' },
    { key: 'outstanding' as const, label: 'Outstanding', value: outstanding, sub: `${outstandingRows.length} unpaid`, icon: AlertCircle, tone: 'text-amber-700' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Revenue & outstanding balances"
        actions={
          <div className="flex items-center gap-2">
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted"><Printer className="h-4 w-4" /> Print</button>
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted"><Download className="h-4 w-4" /> Export</button>
          </div>
        }
      />

      {/* Date range */}
      <div className="flex flex-col gap-2">
        <Segmented
          value={range}
          onChange={(v) => setRange(v as RangeKey)}
          options={(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => ({ value: k, label: RANGE_LABEL[k] }))}
        />
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{RANGE_LABEL[range]}</span> · 01 Jul 2026 – 31 Jul 2026
        </p>
      </div>

      {/* Metric cards (clickable → tab) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metrics.map((m) => {
          const active = tab === m.key
          const Icon = m.icon
          return (
            <button
              key={m.key}
              onClick={() => setTab(m.key)}
              className={cn(
                'rounded-xl border bg-card p-5 text-left shadow-sm transition-all',
                active ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40',
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{m.label}</p>
                <Icon className={cn('h-4 w-4', m.tone)} />
              </div>
              <p className={cn('mt-2 text-2xl font-semibold tabular-nums sm:text-3xl', m.tone)}>{rm(m.value)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.sub}{active ? ' · showing below' : ''}</p>
            </button>
          )
        })}
      </div>

      {/* Tabs */}
      <Segmented
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        options={[
          { value: 'all', label: 'All', count: billedRows.length },
          { value: 'collected', label: 'Collected', count: PAYMENTS.length },
          { value: 'outstanding', label: 'Outstanding', count: outstandingRows.length },
          { value: 'clinic', label: 'By clinic' },
          { value: 'product', label: 'By product' },
        ]}
        className="max-w-full overflow-x-auto"
      />

      {tab === 'all' && <AllTable rows={billedRows} total={totalInvoiced} />}
      {tab === 'collected' && <CollectedTable rows={PAYMENTS} total={collected} />}
      {tab === 'outstanding' && <OutstandingView rows={outstandingRows} total={outstanding} />}
      {tab === 'clinic' && <ByClinic />}
      {tab === 'product' && <ByProduct />}
    </div>
  )
}

function TotalFooter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <Money value={value} className="font-semibold text-foreground" />
    </div>
  )
}

function AllTable({ rows, total }: { rows: Invoice[]; total: number }) {
  const columns: Col<Invoice>[] = [
    { key: 'number', header: 'Invoice #', cell: (i) => <span className="font-medium text-primary">{i.number}</span> },
    { key: 'clinic', header: 'Clinic', cell: (i) => <span className="text-foreground">{i.clinic}</span> },
    { key: 'date', header: 'Date', cell: (i) => <span className="text-muted-foreground">{shortDate(i.date)}</span> },
    { key: 'status', header: 'Status', cell: (i) => <StatusPill tone={INVOICE_STATUS[i.status].tone} dot>{INVOICE_STATUS[i.status].label}</StatusPill> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (i) => <Money value={i.amount} className="font-medium" /> },
  ]
  return <DataTable columns={columns} rows={rows} rowKey={(i) => i.id} footer={<TotalFooter label={`${rows.length} invoices`} value={total} />} />
}

function CollectedTable({ rows, total }: { rows: Payment[]; total: number }) {
  const columns: Col<Payment>[] = [
    { key: 'date', header: 'Date', cell: (p) => <span className="text-muted-foreground">{shortDate(p.date)}</span> },
    { key: 'invoice', header: 'Invoice #', cell: (p) => <span className="font-medium text-primary">{p.invoice}</span> },
    { key: 'clinic', header: 'Clinic', cell: (p) => <span className="text-foreground">{p.clinic}</span> },
    { key: 'ref', header: 'Reference', cell: (p) => <span className="text-muted-foreground">{p.ref}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (p) => <Money value={p.amount} className="font-medium text-green-700" /> },
  ]
  return <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} footer={<TotalFooter label={`${rows.length} payments`} value={total} />} />
}

function OutstandingView({ rows, total }: { rows: Invoice[]; total: number }) {
  const buckets = [
    { label: 'Not due', tone: 'text-foreground', test: (d: number) => d <= 0 },
    { label: '1–30 days', tone: 'text-amber-700', test: (d: number) => d >= 1 && d <= 30 },
    { label: '31–60 days', tone: 'text-orange-700', test: (d: number) => d >= 31 && d <= 60 },
    { label: '61–90 days', tone: 'text-red-700', test: (d: number) => d >= 61 && d <= 90 },
    { label: 'Over 90', tone: 'text-red-800', test: (d: number) => d > 90 },
  ].map((b) => ({ ...b, sum: rows.filter((i) => b.test(daysOverdue(i.due))).reduce((s, i) => s + (i.amount - i.paid), 0) }))

  const columns: Col<Invoice>[] = [
    { key: 'number', header: 'Invoice #', cell: (i) => <span className="font-medium text-primary">{i.number}</span> },
    { key: 'clinic', header: 'Clinic', cell: (i) => <span className="text-foreground">{i.clinic}</span> },
    { key: 'due', header: 'Due', cell: (i) => <span className="text-muted-foreground">{shortDate(i.due)}</span> },
    {
      key: 'aging', header: 'Aging',
      cell: (i) => { const d = daysOverdue(i.due); return d > 0 ? <span className="text-xs font-medium text-red-600">{d}d overdue</span> : <span className="text-xs text-muted-foreground">Not due</span> },
    },
    { key: 'balance', header: 'Balance', align: 'right', cell: (i) => <Money value={i.amount - i.paid} className="font-medium" /> },
    { key: 'status', header: 'Status', align: 'right', cell: (i) => <StatusPill tone={INVOICE_STATUS[i.status].tone} dot>{INVOICE_STATUS[i.status].label}</StatusPill> },
  ]
  return (
    <div className="space-y-4">
      <Panel className="grid grid-cols-2 divide-border sm:grid-cols-5 sm:divide-x">
        {buckets.map((b, idx) => (
          <div key={b.label} className={cn('p-4', idx < buckets.length - 1 && 'border-b border-border sm:border-b-0')}>
            <p className="text-xs font-medium text-muted-foreground">{b.label}</p>
            <p className={cn('mt-1 text-lg font-semibold tabular-nums', b.tone)}>{rm(b.sum)}</p>
          </div>
        ))}
      </Panel>
      <DataTable columns={columns} rows={rows} rowKey={(i) => i.id} footer={<TotalFooter label={`${rows.length} unpaid`} value={total} />} />
    </div>
  )
}

function ByClinic() {
  const agg = useMemo(() => {
    const map = new Map<string, { clinic: string; count: number; sales: number; paid: number }>()
    for (const i of INVOICES) {
      if (i.status === 'voided' || i.status === 'draft') continue
      const cur = map.get(i.clinic) ?? { clinic: i.clinic, count: 0, sales: 0, paid: 0 }
      cur.count++; cur.sales += i.amount; cur.paid += i.paid
      map.set(i.clinic, cur)
    }
    return [...map.values()].map((r) => ({ ...r, outstanding: r.sales - r.paid })).sort((a, b) => b.sales - a.sales)
  }, [])
  const max = Math.max(...agg.map((a) => a.sales))
  type Row = typeof agg[number]
  const columns: Col<Row>[] = [
    { key: 'clinic', header: 'Clinic', cell: (r) => <span className="font-medium text-foreground">{r.clinic}</span> },
    { key: 'count', header: 'Invoices', align: 'right', cell: (r) => <span className="tabular-nums text-muted-foreground">{r.count}</span> },
    { key: 'sales', header: 'Sales', align: 'right', cell: (r) => <Money value={r.sales} className="font-medium" /> },
    { key: 'paid', header: 'Paid', align: 'right', cell: (r) => <Money value={r.paid} className="text-green-700" /> },
    { key: 'out', header: 'Outstanding', align: 'right', cell: (r) => r.outstanding > 0 ? <Money value={r.outstanding} className="text-amber-700" /> : <span className="text-muted-foreground">—</span> },
  ]
  return (
    <div className="space-y-4">
      <Panel className="p-6">
        <h3 className="text-sm font-semibold">Sales by clinic</h3>
        <ol className="mt-4 space-y-3">
          {agg.map((r) => (
            <li key={r.clinic}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-foreground">{r.clinic}</span>
                <Money value={r.sales} className="shrink-0 font-semibold" />
              </div>
              <Bar value={r.sales} max={max} color={BRAND} className="mt-1.5" />
            </li>
          ))}
        </ol>
      </Panel>
      <DataTable columns={columns} rows={agg} rowKey={(r) => r.clinic} />
    </div>
  )
}

function ByProduct() {
  const agg = useMemo(() =>
    SERVICES.filter((s) => s.jobsThisMonth > 0)
      .map((s) => ({ name: s.name, qty: s.jobsThisMonth, total: s.jobsThisMonth * s.price }))
      .sort((a, b) => b.total - a.total)
  , [])
  const max = Math.max(...agg.map((a) => a.total))
  type Row = typeof agg[number]
  const columns: Col<Row>[] = [
    { key: 'name', header: 'Product', cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    { key: 'qty', header: 'Quantity', align: 'right', cell: (r) => <span className="tabular-nums text-muted-foreground">{r.qty}</span> },
    { key: 'total', header: 'Revenue', align: 'right', cell: (r) => <Money value={r.total} className="font-medium" /> },
  ]
  return (
    <div className="space-y-4">
      <Panel className="p-6">
        <h3 className="text-sm font-semibold">Revenue by product</h3>
        <ol className="mt-4 space-y-3">
          {agg.map((r) => (
            <li key={r.name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-foreground">{r.name}</span>
                <Money value={r.total} className="shrink-0 font-semibold" />
              </div>
              <Bar value={r.total} max={max} color={SAGE} className="mt-1.5" />
            </li>
          ))}
        </ol>
      </Panel>
      <DataTable columns={columns} rows={agg} rowKey={(r) => r.name} />
    </div>
  )
}

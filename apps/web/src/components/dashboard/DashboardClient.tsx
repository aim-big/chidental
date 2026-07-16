'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Metric } from '@/components/ui/metric'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  AlertCircle, ArrowRight, Clock, DollarSign, FileText, Plus, TrendingDown,
  TrendingUp, Users, Wallet,
} from 'lucide-react'
import { formatCompactCurrency, formatCurrency } from '@/lib/utils'
import type { DashboardSummary } from '@/lib/dashboard'
import type { PresetMap } from '@/lib/reports-presets'
import { DateRangePicker } from '@/components/date-range-picker'

export function DashboardClient({
  from, to, summary, presets, customerCount, canCreateInvoice, canViewWork,
}: {
  from: string
  to: string
  summary: DashboardSummary
  presets: PresetMap
  customerCount: number
  canCreateInvoice: boolean
  canViewWork: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const setRange = (next: { from: string; to: string }) => {
    const params = new URLSearchParams(next)
    startTransition(() => router.push(`/dashboard?${params.toString()}`, { scroll: false }))
  }

  const {
    sales, paymentsReceived, outstanding, overdueCount, overdueAmount, invoiceCount,
    salesGrowthPct, salesYoYPct, collectionRate, avgDaysToCollect,
    avgInvoiceValue, avgInvoiceValuePrior, newClinics, returningClinics,
    wip, trend, byProduct, byCustomer,
  } = summary

  const collectionPercent = collectionRate == null ? null : Math.round(collectionRate * 100)
  const trendSummary = collectionPercent == null
    ? 'Sales issued and cash received across the selected period.'
    : `Cash received is ${collectionPercent}% of sales issued in this period.`

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Money, collections, and production at a glance.</p>
        </div>
        {canCreateInvoice && (
          <Button className="w-full sm:w-auto" asChild>
            <Link href="/invoices/new"><Plus className="h-4 w-4" aria-hidden />New Invoice</Link>
          </Button>
        )}
      </header>

      <DateRangePicker from={from} to={to} presets={presets} isPending={isPending} onRangeChange={setRange} />

      {/* One financial ledger: hierarchy comes from width and dividers, not repeated cards. */}
      <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="money-ledger-heading">
        <h2 id="money-ledger-heading" className="sr-only">Money position</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="bg-accent/55 p-5 sm:col-span-2 sm:p-6 lg:col-span-1">
            <Metric
              hero
              label="Outstanding"
              icon={<AlertCircle className="h-4 w-4" aria-hidden />}
              tone="warning"
              value={formatCurrency(outstanding)}
              hint="All-time balance due"
            />
            <div className="mt-5 border-t border-brand/15 pt-4">
              {overdueCount > 0 ? (
                <p className="text-sm text-danger">
                  <span className="font-semibold tabular-nums">{overdueCount}</span>{' '}
                  {overdueCount === 1 ? 'invoice' : 'invoices'} past due ·{' '}
                  <span className="font-semibold tabular-nums">{formatCurrency(overdueAmount)}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No invoices are currently overdue.</p>
              )}
              {canViewWork && (
                <Link href="/invoices?view=unpaid" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Review unpaid invoices <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </div>
          </div>

          <LedgerCell className="border-t sm:border-r lg:border-l lg:border-r-0 lg:border-t-0" label="Sales" icon={<DollarSign className="h-4 w-4" aria-hidden />} value={formatCurrency(sales)}>
            <GrowthBadge pct={salesGrowthPct} label="vs last period" />
            {salesYoYPct != null && <GrowthBadge pct={salesYoYPct} label="vs last year" />}
          </LedgerCell>
          <LedgerCell className="border-t lg:border-l lg:border-t-0" label="Cash Received" icon={<Wallet className="h-4 w-4" aria-hidden />} tone="success" value={formatCurrency(paymentsReceived)}>
            {collectionPercent != null ? `${collectionPercent}% of sales in this period` : 'cash collected in this period'}
          </LedgerCell>
          <LedgerCell className="border-t sm:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0" label="Invoices Issued" icon={<FileText className="h-4 w-4" aria-hidden />} value={String(invoiceCount)}>
            avg {formatCurrency(avgInvoiceValue)} per invoice
          </LedgerCell>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card" aria-labelledby="production-heading">
        <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="production-heading" className="text-base font-semibold">Production pulse</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{wip.total} active {wip.total === 1 ? 'item' : 'items'} on the floor</p>
          </div>
          {canViewWork && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/work">Open Work board <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </Button>
          )}
        </div>
        {wip.total > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <WipStat label="Received" count={wip.received} dotClass="bg-muted-foreground" />
            <WipStat label="In Progress" count={wip.inProgress} dotClass="bg-info" className="border-l" />
            <WipStat label="Ready" count={wip.ready} dotClass="bg-success" className="border-t sm:border-l sm:border-t-0" />
            <WipStat label="On Hold" count={wip.onHold} dotClass="bg-warning" className="border-l border-t sm:border-t-0" />
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">No jobs on the floor — every item is delivered.</p>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(17rem,0.75fr)]">
        <section className="rounded-lg border border-border bg-card" aria-labelledby="trend-heading">
          <div className="border-b border-border px-5 py-4">
            <h2 id="trend-heading" className="text-base font-semibold">Sales vs Cash Received</h2>
            <p className="mt-1 text-sm text-muted-foreground">{trendSummary}</p>
          </div>
          <div className="p-4 sm:p-5">
            {trend.length > 0 && (sales > 0 || paymentsReceived > 0) ? (
              <div className="h-[280px] w-full tabular-nums sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} accessibilityLayer aria-label={trendSummary}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                    <YAxis width="auto" tickFormatter={formatCompactCurrency} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickMargin={8} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'var(--popover)', borderColor: 'var(--border)', borderRadius: 'var(--radius)' }} labelStyle={{ color: 'var(--foreground)' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar name="Sales" dataKey="sales" fill="var(--brand)" radius={[3, 3, 0, 0]} />
                    <Bar name="Cash Received" dataKey="payments" fill="var(--success)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No invoices or payments in this period</p>
            )}
          </div>
        </section>

        <aside className="rounded-lg bg-foreground p-5 text-card sm:p-6" aria-labelledby="collection-heading">
          <h2 id="collection-heading" className="text-base font-semibold">Collection health</h2>
          <p className="mt-1 text-sm text-card/70">How quickly issued value is turning into cash.</p>
          <dl className="mt-6 space-y-5">
            <CollectionStat label="Collection rate" value={collectionPercent == null ? '—' : `${collectionPercent}%`} />
            <CollectionStat label="Average time to payment" value={avgDaysToCollect == null ? '—' : `${avgDaysToCollect} days`} />
            <CollectionStat label="Overdue value" value={formatCurrency(overdueAmount)} />
          </dl>
        </aside>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="ranked-heading">
        <div className="border-b border-border px-5 py-4">
          <h2 id="ranked-heading" className="text-base font-semibold">What is driving sales</h2>
          <p className="mt-1 text-sm text-muted-foreground">Products and clinics ranked by billed value.</p>
        </div>
        <div className="grid lg:grid-cols-2">
          <RankedSection title="Top Products" items={byProduct} />
          <RankedSection title="Top Clinics" items={byCustomer} bordered />
        </div>
      </section>

      <footer className="overflow-hidden rounded-lg border border-border bg-surface-2" aria-label="Operational context">
        <div className="grid grid-cols-2 xl:grid-cols-4">
          <ContextMetric icon={<Users className="h-4 w-4" aria-hidden />} label="New clinics" value={String(newClinics)} hint="not billed last period" />
          <ContextMetric icon={<Users className="h-4 w-4" aria-hidden />} label="Returning clinics" value={String(returningClinics)} hint={`of ${customerCount} total`} className="border-l" />
          <ContextMetric icon={<DollarSign className="h-4 w-4" aria-hidden />} label="Avg invoice value" value={formatCurrency(avgInvoiceValue)} hint={avgInvoiceValuePrior > 0 ? `was ${formatCurrency(avgInvoiceValuePrior)}` : 'no prior period'} className="border-t xl:border-l xl:border-t-0" />
          <ContextMetric icon={<Clock className="h-4 w-4" aria-hidden />} label="Avg time to payment" value={avgDaysToCollect != null ? `${avgDaysToCollect} days` : '—'} hint={avgDaysToCollect != null ? 'from invoice to payment' : 'no payments in this period'} className="border-l border-t xl:border-t-0" />
        </div>
      </footer>
    </div>
  )
}

function LedgerCell({ className = '', label, value, icon, tone = 'default', children }: {
  className?: string
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  tone?: 'default' | 'success'
  children: React.ReactNode
}) {
  return (
    <div className={`p-5 sm:p-6 ${className}`}>
      <Metric label={label} icon={icon} tone={tone} value={value} hint={children} />
    </div>
  )
}

function WipStat({ label, count, dotClass, className = '' }: { label: string; count: number; dotClass: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 border-border px-5 py-4 ${className}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      <div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function CollectionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-card/15 pt-4 first:border-t-0 first:pt-0">
      <dt className="text-xs font-medium text-card/65">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function RankedSection({ title, items, bordered = false }: { title: string; items: { name: string; total: number }[]; bordered?: boolean }) {
  return (
    <section className={`p-5 sm:p-6 ${bordered ? 'border-t border-border lg:border-l lg:border-t-0' : ''}`}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length > 0 ? <RankedList items={items} /> : <p className="py-8 text-sm text-muted-foreground">No billed value in this period</p>}
    </section>
  )
}

function RankedList({ items }: { items: { name: string; total: number }[] }) {
  const visible = items.slice(0, 5)
  const max = Math.max(...visible.map(item => item.total), 0)
  return (
    <ol className="mt-4 space-y-4">
      {visible.map((item, index) => (
        <li key={item.name} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3">
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{index + 1}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground" title={item.name}>{item.name}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand" style={{ width: max > 0 ? `${Math.max((item.total / max) * 100, 4)}%` : '0%' }} />
            </div>
          </div>
          <span className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(item.total)}</span>
        </li>
      ))}
    </ol>
  )
}

function ContextMetric({ label, value, hint, icon, className = '' }: { label: string; value: string; hint: string; icon: React.ReactNode; className?: string }) {
  return (
    <div className={`border-border p-4 sm:p-5 ${className}`}>
      <Metric label={label} value={value} hint={hint} icon={icon} />
    </div>
  )
}

function GrowthBadge({ pct, label }: { pct: number | null; label: string }) {
  if (pct == null) return <span className="block text-xs text-muted-foreground">no prior period</span>
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${up ? 'text-success' : 'text-danger'}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {up ? '+' : ''}{(pct * 100).toFixed(0)}% {label}
    </span>
  )
}

'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Metric } from '@/components/ui/metric'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  DollarSign, Wallet, AlertCircle, FileText, TrendingUp, TrendingDown, Plus, Users, Clock, ArrowRight,
} from 'lucide-react'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import type { DashboardSummary } from '@/lib/dashboard'
import type { PresetMap } from '@/lib/reports-presets'
import { DateRangePicker } from '@/components/date-range-picker'

// Interactive shell for the dashboard. The Server Component fetches + computes
// `summary`; this island renders it and drives the date range through the URL so
// a change re-runs the server query (same pattern as the reports page).
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back</p>
        </div>
        {canCreateInvoice && (
          <Button className="w-full sm:w-auto" asChild>
            <Link href="/invoices/new"><Plus className="h-4 w-4 mr-2" />New Invoice</Link>
          </Button>
        )}
      </div>

      {/* Date range picker (shared segmented control) */}
      <DateRangePicker from={from} to={to} presets={presets} isPending={isPending} onRangeChange={setRange} />

      {/* KPI metrics — Outstanding (money owed) is the decision-driving hero */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4 sm:p-5">
          <Metric
            label="Sales"
            icon={<DollarSign className="h-4 w-4" />}
            value={formatCurrency(sales)}
            hint={
              <>
                <GrowthBadge pct={salesGrowthPct} label="vs last period" />
                {salesYoYPct != null && <GrowthBadge pct={salesYoYPct} label="vs last year" />}
              </>
            }
          />
        </Card>
        <Card className="p-4 sm:p-5">
          <Metric
            label="Cash Received"
            icon={<Wallet className="h-4 w-4" />}
            tone="success"
            value={formatCurrency(paymentsReceived)}
            hint={collectionRate != null ? `${Math.round(collectionRate * 100)}% of sales in this period` : 'cash collected in this period'}
          />
        </Card>
        <Card className="p-4 sm:p-5">
          <Metric
            hero
            label="Outstanding"
            icon={<AlertCircle className="h-4 w-4" />}
            tone="warning"
            value={formatCurrency(outstanding)}
            hint={
              overdueCount > 0 ? (
                <span className="font-medium text-danger">
                  {overdueCount} overdue · {formatCurrency(overdueAmount)} past due
                </span>
              ) : (
                'owed now (all time) · nothing overdue'
              )
            }
          />
        </Card>
        <Card className="p-4 sm:p-5">
          <Metric
            label="Invoices Issued"
            icon={<FileText className="h-4 w-4" />}
            value={String(invoiceCount)}
            hint={`avg ${formatCurrency(avgInvoiceValue)} per invoice`}
          />
        </Card>
      </div>

      {/* Jobs on the floor right now — the production heartbeat of the lab */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Work In Progress</CardTitle>
          {canViewWork && (
            <Link href="/work" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              Open Work board <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {wip.total > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <WipStat label="Received" count={wip.received} dotClass="bg-muted-foreground" />
              <WipStat label="In Progress" count={wip.inProgress} dotClass="bg-info" />
              <WipStat label="Ready" count={wip.ready} dotClass="bg-success" />
              <WipStat label="On Hold" count={wip.onHold} dotClass="bg-warning" />
            </div>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">No jobs on the floor — every item is delivered.</p>
          )}
        </CardContent>
      </Card>

      {/* Sales vs Cash Received trend */}
      <Card>
        <CardHeader><CardTitle className="text-base">Sales vs Cash Received</CardTitle></CardHeader>
        <CardContent>
          {trend.length > 0 && (sales > 0 || paymentsReceived > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trend} margin={{ top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatCompactCurrency} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar name="Sales" dataKey="sales" fill="var(--brand)" radius={[4, 4, 0, 0]} />
                <Bar name="Cash received" dataKey="payments" fill="var(--success)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-8">No invoices or payments in this period</p>}
        </CardContent>
      </Card>

      {/* Top products + top clinics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top Products</CardTitle></CardHeader>
          <CardContent>
            {byProduct.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byProduct} layout="vertical" margin={{ left: 140 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={formatCompactCurrency} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill="var(--brand)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-8">No products billed in this period</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top Clinics</CardTitle></CardHeader>
          <CardContent>
            {byCustomer.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byCustomer} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={formatCompactCurrency} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill="var(--brand)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-8">No clinics billed in this period</p>}
          </CardContent>
        </Card>
      </div>

      {/* Growth strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4 sm:p-5">
          <Metric
            icon={<Users className="h-4 w-4" />}
            label="New clinics"
            value={String(newClinics)}
            hint="not billed last period"
          />
        </Card>
        <Card className="p-4 sm:p-5">
          <Metric
            icon={<Users className="h-4 w-4" />}
            label="Returning clinics"
            value={String(returningClinics)}
            hint={`of ${customerCount} total`}
          />
        </Card>
        <Card className="p-4 sm:p-5">
          <Metric
            icon={<DollarSign className="h-4 w-4" />}
            label="Avg invoice value"
            value={formatCurrency(avgInvoiceValue)}
            hint={avgInvoiceValuePrior > 0 ? `was ${formatCurrency(avgInvoiceValuePrior)}` : 'no prior period'}
          />
        </Card>
        <Card className="p-4 sm:p-5">
          <Metric
            icon={<Clock className="h-4 w-4" />}
            label="Avg time to payment"
            value={avgDaysToCollect != null ? `${avgDaysToCollect} days` : '—'}
            hint={avgDaysToCollect != null ? 'from invoice to payment' : 'no payments in this period'}
          />
        </Card>
      </div>
    </div>
  )
}

function WipStat({ label, count, dotClass }: { label: string; count: number; dotClass: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      <div>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function GrowthBadge({ pct, label = 'vs last period' }: { pct: number | null; label?: string }) {
  if (pct == null) return <span className="block text-xs text-muted-foreground">no prior period</span>
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${up ? 'text-success' : 'text-danger'}`}>
      <Icon className="h-3.5 w-3.5" />
      {up ? '+' : ''}{(pct * 100).toFixed(0)}% {label}
    </span>
  )
}

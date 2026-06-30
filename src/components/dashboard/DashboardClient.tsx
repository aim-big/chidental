'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  DollarSign, Wallet, AlertCircle, FileText, TrendingUp, TrendingDown, Plus, Users,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { DashboardSummary } from '@/lib/dashboard'

const BRAND_CHART = '#766254'
const BRAND_CHART_SOFT = '#9b8779'

// Interactive shell for the dashboard. The Server Component fetches + computes
// `summary`; this island renders it and drives the date range through the URL so
// a change re-runs the server query (same pattern as the reports page).
export function DashboardClient({
  from, to, summary, customerCount, canCreateInvoice,
}: {
  from: string
  to: string
  summary: DashboardSummary
  customerCount: number
  canCreateInvoice: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const setRange = (next: { from?: string; to?: string }) => {
    const params = new URLSearchParams({ from: next.from ?? from, to: next.to ?? to })
    startTransition(() => router.push(`/dashboard?${params.toString()}`))
  }

  const {
    sales, paymentsReceived, outstanding, invoiceCount, salesGrowthPct,
    avgInvoiceValue, avgInvoiceValuePrior, newClinics, returningClinics,
    trend, byProduct, byCustomer,
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

      {/* Date range */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Label>From</Label>
          <Input type="date" value={from} onChange={e => setRange({ from: e.target.value })} className="w-full sm:w-40" />
        </div>
        <div className="space-y-2">
          <Label>To</Label>
          <Input type="date" value={to} onChange={e => setRange({ to: e.target.value })} className="w-full sm:w-40" />
        </div>
        {isPending && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mb-2" />}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Sales"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          value={formatCurrency(sales)}
          sub={<GrowthBadge pct={salesGrowthPct} />}
        />
        <KpiCard
          title="Payment"
          icon={<Wallet className="h-4 w-4 text-green-600" />}
          value={formatCurrency(paymentsReceived)}
          valueClass="text-green-700"
          sub={<span className="text-xs text-muted-foreground">cash collected</span>}
        />
        <KpiCard
          title="Outstanding"
          icon={<AlertCircle className="h-4 w-4 text-yellow-500" />}
          value={formatCurrency(outstanding)}
          valueClass="text-yellow-700"
          sub={<span className="text-xs text-muted-foreground">owed now (all time)</span>}
        />
        <KpiCard
          title="Total Invoices"
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          value={String(invoiceCount)}
          sub={<span className="text-xs text-muted-foreground">avg {formatCurrency(avgInvoiceValue)}</span>}
        />
      </div>

      {/* Sales vs Payment trend */}
      <Card>
        <CardHeader><CardTitle className="text-base">Sales vs Payment</CardTitle></CardHeader>
        <CardContent>
          {trend.length > 0 && (sales > 0 || paymentsReceived > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trend} margin={{ top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `RM${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar name="Sales" dataKey="sales" fill={BRAND_CHART} radius={[4, 4, 0, 0]} />
                <Bar name="Payment" dataKey="payments" fill={BRAND_CHART_SOFT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-8">No data for this period</p>}
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
                  <XAxis type="number" tickFormatter={v => `RM${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill={BRAND_CHART} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-8">No data for this period</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top Clinics</CardTitle></CardHeader>
          <CardContent>
            {byCustomer.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byCustomer} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `RM${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill={BRAND_CHART_SOFT} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-8">No data for this period</p>}
          </CardContent>
        </Card>
      </div>

      {/* Growth strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          label="New clinics"
          value={String(newClinics)}
          hint="not billed last period"
        />
        <StatTile
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          label="Returning clinics"
          value={String(returningClinics)}
          hint={`of ${customerCount} total`}
        />
        <StatTile
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          label="Avg invoice value"
          value={formatCurrency(avgInvoiceValue)}
          hint={avgInvoiceValuePrior > 0 ? `was ${formatCurrency(avgInvoiceValuePrior)}` : 'no prior period'}
        />
      </div>
    </div>
  )
}

function KpiCard({
  title, icon, value, valueClass, sub,
}: {
  title: string
  icon: React.ReactNode
  value: string
  valueClass?: string
  sub?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold tabular-nums sm:text-3xl ${valueClass ?? 'text-foreground'}`}>{value}</p>
        {sub && <div className="mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">no prior period</span>
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
      <Icon className="h-3.5 w-3.5" />
      {up ? '+' : ''}{(pct * 100).toFixed(0)}% vs last period
    </span>
  )
}

function StatTile({
  icon, label, value, hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

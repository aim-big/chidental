'use client'

// IMPECCABLE REDESIGN DEMO — Dashboard. Renders inside the shared /demo shell.
// Hierarchy-driven: one hero number, a real production pipeline, a brand-colored
// chart, ranked lists. Self-contained mock data. Originals untouched.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, ArrowRight, ArrowUpRight, ArrowDownRight, CircleDot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, Panel, Bar, BRAND, SAGE } from '../_components/kit'
import { rm, rmCompact } from '../_lib/mock'

const PERIOD = 'July 2026'
const MONEY = { sales: 128450, salesPrev: 112000, salesLastYear: 98200, cash: 96180, outstanding: 214900, overdueCount: 7, overdueAmount: 38600, invoiceCount: 84 }
const TREND = [
  { label: 'Feb', sales: 92000, cash: 85000 },
  { label: 'Mar', sales: 104000, cash: 90000 },
  { label: 'Apr', sales: 99000, cash: 96000 },
  { label: 'May', sales: 118000, cash: 101000 },
  { label: 'Jun', sales: 112000, cash: 108000 },
  { label: 'Jul', sales: 128450, cash: 96180 },
]
const PIPELINE = [
  { key: 'received', label: 'Received', count: 12, color: '#0ea5e9' },
  { key: 'progress', label: 'In progress', count: 23, color: '#f59e0b' },
  { key: 'ready', label: 'Ready', count: 9, color: '#22c55e' },
  { key: 'hold', label: 'On hold', count: 4, color: '#94a3b8' },
]
const TOP_CLINICS = [
  { name: 'Klinik Pergigian Sri Damansara', total: 24300 },
  { name: 'Smile Dental · Bangsar', total: 19850 },
  { name: 'Kota Damansara Dental', total: 16400 },
  { name: 'Dr. Tan Dental Surgery', total: 12900 },
  { name: 'Pusat Pergigian Ampang', total: 9750 },
]
const TOP_PRODUCTS = [
  { name: 'Zirconia Crown', total: 41200 },
  { name: 'PFM Crown', total: 22600 },
  { name: 'Implant Abutment', total: 18300 },
  { name: 'Full Denture (Acrylic)', total: 14100 },
  { name: 'Night Guard', total: 6800 },
]
const GLANCE = [
  { label: 'New clinics', value: '3', hint: 'first time this period' },
  { label: 'Returning clinics', value: '21', hint: 'of 64 total' },
  { label: 'Avg invoice', value: rm(1529), hint: 'was RM1,438' },
  { label: 'Time to payment', value: '22 days', hint: 'invoice → paid' },
]

export default function DemoDashboard() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const collectionRate = Math.round((MONEY.cash / MONEY.sales) * 100)
  const wipTotal = PIPELINE.reduce((s, p) => s + p.count, 0)

  return (
    <div
      className={
        'space-y-5 transition-all duration-500 ease-out motion-reduce:transition-none ' +
        (mounted ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0')
      }
    >
      <PageHeader
        title="Dashboard"
        subtitle={<span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />{PERIOD} · live</span>}
        actions={<Button asChild><Link href="/demo/invoices"><Plus className="mr-2 h-4 w-4" /> New invoice</Link></Button>}
      />

      {/* Money band — one hero number + supporting stats joined by dividers */}
      <Panel className="overflow-hidden">
        <div className="grid lg:grid-cols-[1.5fr_1fr]">
          <div className="border-b border-border p-6 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium text-muted-foreground">Sales this period</p>
              <span className="text-xs text-muted-foreground">{MONEY.invoiceCount} invoices issued</span>
            </div>
            <p className="mt-2 text-[2.75rem] font-semibold leading-none tracking-tight tabular-nums sm:text-6xl">{rm(MONEY.sales)}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Delta value={(MONEY.sales - MONEY.salesPrev) / MONEY.salesPrev} label="vs June" />
              <Delta value={(MONEY.sales - MONEY.salesLastYear) / MONEY.salesLastYear} label="vs last year" />
            </div>
            <div className="mt-5"><Sparkline values={TREND.map((t) => t.sales)} /></div>
          </div>
          <div className="divide-y divide-border">
            <div className="p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Cash received</p>
                <span className="text-xs font-medium text-green-700">{collectionRate}% of sales</span>
              </div>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-green-700 sm:text-3xl">{rm(MONEY.cash)}</p>
              <Bar value={collectionRate} max={100} color="#16a34a" className="mt-3 h-2" />
            </div>
            <div className="p-6 sm:p-7">
              <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums sm:text-3xl">{rm(MONEY.outstanding)}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                <CircleDot className="h-3.5 w-3.5" />
                {MONEY.overdueCount} overdue · {rm(MONEY.overdueAmount)} past due
              </p>
            </div>
          </div>
        </div>
      </Panel>

      {/* Production pipeline */}
      <Panel className="p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-base font-semibold">On the floor</h2>
            <span className="text-sm text-muted-foreground"><span className="font-semibold tabular-nums text-foreground">{wipTotal}</span> jobs in production</span>
          </div>
          <Link href="/demo/work" className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80">
            Open work board <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {PIPELINE.map((s) => (
            <div key={s.key} className="h-full" style={{ flexGrow: s.count, backgroundColor: s.color, minWidth: 6 }} title={`${s.label}: ${s.count}`} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {PIPELINE.map((s) => (
            <div key={s.key} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-tight tabular-nums">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Sales vs cash */}
      <Panel className="p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Sales vs cash received</h2>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Swatch color={BRAND} label="Sales" />
            <Swatch color={SAGE} label="Cash" />
          </div>
        </div>
        <div className="mt-5"><TrendChart data={TREND} /></div>
      </Panel>

      {/* Ranked lists */}
      <div className="grid gap-5 lg:grid-cols-2">
        <RankedList title="Top clinics" items={TOP_CLINICS} color={BRAND} />
        <RankedList title="Top products" items={TOP_PRODUCTS} color={SAGE} />
      </div>

      {/* At a glance */}
      <Panel className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
        {GLANCE.map((g, i) => (
          <div key={g.label} className={'p-5 ' + (i < 2 ? 'border-b border-border sm:border-b-0 ' : '') + (i % 2 === 1 ? 'border-l border-border sm:border-l-0 ' : '')}>
            <p className="text-xs font-medium text-muted-foreground">{g.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{g.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{g.hint}</p>
          </div>
        ))}
      </Panel>
    </div>
  )
}

function Delta({ value, label }: { value: number; label: string }) {
  const up = value >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Icon className={`h-4 w-4 ${up ? 'text-green-600' : 'text-red-600'}`} />
      <span className={`font-semibold tabular-nums ${up ? 'text-green-700' : 'text-red-700'}`}>{up ? '+' : ''}{Math.round(value * 100)}%</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden />{label}</span>
}

function Sparkline({ values }: { values: number[] }) {
  const W = 260, H = 52, min = Math.min(...values), max = Math.max(...values), span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => H - 6 - ((v - min) / span) * (H - 12)
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={BRAND} opacity="0.09" />
      <polyline points={line} fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="3" fill={BRAND} />
    </svg>
  )
}

function TrendChart({ data }: { data: typeof TREND }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720, H = 260, padL = 46, padR = 8, padT = 18, padB = 30
  const plotW = W - padL - padR, plotH = H - padT - padB
  const niceMax = Math.ceil(Math.max(...data.flatMap((d) => [d.sales, d.cash])) / 20000) * 20000
  const ticks = 4, groupW = plotW / data.length, barW = Math.min(26, groupW * 0.3), gap = 6
  const yOf = (v: number) => padT + plotH - (v / niceMax) * plotH
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Monthly sales versus cash received over six months" onMouseLeave={() => setHover(null)}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (niceMax / ticks) * i, y = yOf(v)
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />
            <text x={padL - 8} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{rmCompact(v)}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const gx = padL + i * groupW, cx = gx + groupW / 2, active = hover === i
        const salesX = cx - barW - gap / 2, cashX = cx + gap / 2
        return (
          <g key={d.label}>
            {active && <rect x={gx + 2} y={padT} width={groupW - 4} height={plotH} rx="6" className="fill-muted" opacity="0.6" />}
            <rect x={gx} y={padT} width={groupW} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
            <rect x={salesX} y={yOf(d.sales)} width={barW} height={padT + plotH - yOf(d.sales)} rx="3" fill={BRAND} />
            <rect x={cashX} y={yOf(d.cash)} width={barW} height={padT + plotH - yOf(d.cash)} rx="3" fill={SAGE} />
            {active && (
              <>
                <text x={salesX + barW / 2} y={yOf(d.sales) - 6} textAnchor="middle" className="fill-foreground text-[10px] font-semibold">{rmCompact(d.sales)}</text>
                <text x={cashX + barW / 2} y={yOf(d.cash) - 6} textAnchor="middle" className="fill-foreground text-[10px] font-semibold">{rmCompact(d.cash)}</text>
              </>
            )}
            <text x={cx} y={H - 10} textAnchor="middle" className={active ? 'fill-foreground text-[11px] font-medium' : 'fill-muted-foreground text-[11px]'}>{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function RankedList({ title, items, color }: { title: string; items: { name: string; total: number }[]; color: string }) {
  const max = Math.max(...items.map((i) => i.total))
  return (
    <Panel className="p-6 sm:p-7">
      <h2 className="text-base font-semibold">{title}</h2>
      <ol className="mt-4 space-y-3.5">
        {items.map((it, i) => (
          <li key={it.name}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-2.5">
                <span className="w-4 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="truncate text-sm text-foreground">{it.name}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{rm(it.total)}</span>
            </div>
            <Bar value={it.total} max={max} color={color} className="ml-6 mt-1.5" />
          </li>
        ))}
      </ol>
    </Panel>
  )
}

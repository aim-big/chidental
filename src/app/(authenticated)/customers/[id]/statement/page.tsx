// Statement of Account — Server Component.
//
// Two views, URL-driven (`?view=activity|open&from=&to=`):
//   • activity (default) — a period transaction ledger: balance brought
//     forward, then every invoice / payment / credit in [from, to] with a
//     running balance, ending at the closing balance.
//   • open — the classic open-item statement: only invoices that still carry
//     a balance, plus account totals to date.
//
// The date range reuses the Sales Reports preset math (`reports-presets.ts`,
// defaulting to the current month). All money math lives in the pure helpers
// `buildStatement` / `buildActivityStatement` (unit-tested in
// `statement.test.ts`). Renders a print-clean A4 document wrapped in
// #invoice-print (picked up by the @media print rule in globals.css).

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getClinicStatement } from '@/data/customers'
import { getBillingSettings } from '@/data/billing-settings'
import { buildStatement, buildActivityStatement, type ActivityLine, type Statement } from '@/lib/statement'
import { buildPresets, matchPreset, resolveDateRange, PRESET_LABELS, type PresetKind } from '@/lib/reports-presets'
import { COMPANY } from '@/lib/config'
import { formatCurrency, formatDate, todayISODate } from '@/lib/utils'
import { CREDIT_REASON_LABELS } from '@/lib/credit'
import { StatementPrintButton } from '@/components/StatementPrintButton'
import { requirePermission } from '@/lib/auth/require-permission'

function creditReasonLabel(reason: string): string {
  return CREDIT_REASON_LABELS[reason as keyof typeof CREDIT_REASON_LABELS] ?? reason
}

function lineDescription(line: ActivityLine): string {
  switch (line.kind) {
    case 'invoice':
      return line.patient ? `Invoice — ${line.patient}` : 'Invoice'
    case 'payment':
      return line.reference ? `Payment received · Ref ${line.reference}` : 'Payment received'
    case 'credit':
      return `Credit — ${creditReasonLabel(line.reason ?? '')}`
  }
}

function OpenStatementTotals({ stmt }: { stmt: Statement }) {
  return (
    <div className="mb-6 flex justify-end">
      <table className="w-full max-w-sm text-sm">
        <tbody>
          <tr className="border-t-2 border-border">
            <td className="pt-3 text-right text-muted-foreground">Total billed to date</td>
            <td className="pt-3 pl-6 text-right tabular-nums font-semibold text-foreground">
              {formatCurrency(stmt.totalBilled)}
            </td>
          </tr>
          <tr>
            <td className="pt-1 text-right text-muted-foreground">Total paid to date</td>
            <td className="pt-1 pl-6 text-right tabular-nums font-semibold text-foreground">
              {formatCurrency(stmt.totalPaid)}
            </td>
          </tr>
          {stmt.totalCredits > 0 && (
            <tr>
              <td className="pt-1 text-right text-muted-foreground">Less: account credits</td>
              <td className="pt-1 pl-6 text-right tabular-nums font-semibold text-foreground">
                -{formatCurrency(stmt.totalCredits)}
              </td>
            </tr>
          )}
          <tr>
            <td className="pt-2 text-right font-bold text-foreground">
              {stmt.totalCredits > 0 ? 'Account Balance' : 'Balance Due'}
            </td>
            <td className="pt-2 pl-6 text-right tabular-nums text-lg font-bold text-foreground">
              {formatCurrency(stmt.balance)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default async function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string; from?: string; to?: string }>
}) {
  const { id } = await params
  const gate = await requirePermission('customers.view')
  if (gate.ok === false) redirect('/dashboard')

  const sp = await searchParams
  const view: 'activity' | 'open' = sp.view === 'open' ? 'open' : 'activity'
  const now = new Date()
  const { from, to } = resolveDateRange(sp, now)
  const presets = buildPresets(now)
  const activePreset = matchPreset(from, to, presets)

  const [bundle, billing] = await Promise.all([getClinicStatement(id), getBillingSettings()])
  if (!bundle) notFound()

  const { clinic, invoices, payments, credits } = bundle
  const today = todayISODate()
  // Open-item statement is always built: the open view renders it, and both
  // views use its as-of-today aging summary.
  const stmt = buildStatement(invoices, payments, credits, today)
  const activity = buildActivityStatement(invoices, payments, credits, from, to)

  const basePath = `/customers/${id}/statement`
  const rangeQS = `from=${from}&to=${to}`

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Toolbar — hidden on print */}
      <div className="space-y-2 print:hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/customers/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clinic
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
              <Button asChild size="sm" variant={view === 'activity' ? 'secondary' : 'ghost'}>
                <Link href={`${basePath}?view=activity&${rangeQS}`}>Full activity</Link>
              </Button>
              <Button asChild size="sm" variant={view === 'open' ? 'secondary' : 'ghost'}>
                <Link href={`${basePath}?view=open&${rangeQS}`}>Outstanding only</Link>
              </Button>
            </div>
            <StatementPrintButton />
          </div>
        </div>

        {/* Period picker — activity view only (open items are always as-of-today) */}
        {view === 'activity' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1">
              {(Object.keys(PRESET_LABELS) as PresetKind[]).map((kind) => (
                <Button
                  key={kind}
                  asChild
                  size="sm"
                  variant={activePreset === kind ? 'default' : 'outline'}
                >
                  <Link href={`${basePath}?view=activity&from=${presets[kind].from}&to=${presets[kind].to}`}>
                    {PRESET_LABELS[kind]}
                  </Link>
                </Button>
              ))}
            </div>
            {/* key remounts the uncontrolled date inputs when the range changes
                via a preset link (soft navigation keeps DOM state otherwise) */}
            <form method="get" className="flex items-center gap-2" key={`${from}:${to}`}>
              <input type="hidden" name="view" value="activity" />
              <Input type="date" name="from" defaultValue={from} className="h-8 w-auto" aria-label="From date" />
              <span className="text-muted-foreground text-sm">–</span>
              <Input type="date" name="to" defaultValue={to} className="h-8 w-auto" aria-label="To date" />
              <Button type="submit" size="sm" variant="outline">Apply</Button>
            </form>
          </div>
        )}
      </div>

      {/* Printable document */}
      <div
        id="invoice-print"
        className="rounded-lg border border-border bg-card p-4 text-foreground print:border-0 print:p-6 print:shadow-none sm:p-8"
      >
        {/* ── Letterhead ─────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/chidental-rectangle.png"
              alt={COMPANY.name}
              className="max-h-12 max-w-[220px] object-contain object-left mb-2"
            />
            <div className="text-sm text-muted-foreground whitespace-pre-line">{COMPANY.address}</div>
            {COMPANY.phone && <div className="text-sm text-muted-foreground">Tel: {COMPANY.phone}</div>}
            {COMPANY.email && <div className="text-sm text-muted-foreground">{COMPANY.email}</div>}
          </div>
          <div className="text-left sm:text-right">
            <div className="text-2xl font-bold text-muted-foreground uppercase tracking-widest mb-2">
              Statement of Account
            </div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <div>
                <span className="text-muted-foreground">Date: </span>
                <span className="font-semibold text-foreground">{formatDate(today)}</span>
              </div>
              {view === 'activity' ? (
                <div>
                  <span className="text-muted-foreground">Period: </span>
                  <span className="font-semibold text-foreground">
                    {formatDate(from)} – {formatDate(to)}
                  </span>
                </div>
              ) : (
                <div>Outstanding items as at {formatDate(today)}</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Clinic block ───────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">To</div>
          <div className="font-semibold text-foreground text-base">{clinic.clinic_name}</div>
          {clinic.contact_person && (
            <div className="text-sm text-muted-foreground">{clinic.contact_person}</div>
          )}
          {clinic.ssm_no && (
            <div className="text-sm text-muted-foreground">SSM: {clinic.ssm_no}</div>
          )}
          {clinic.billing_address && (
            <div className="text-sm text-muted-foreground whitespace-pre-line mt-0.5">
              {clinic.billing_address}
            </div>
          )}
        </div>

        {view === 'activity' ? (
          /* ── Activity ledger ──────────────────────────────────────────── */
          <div className="-mx-4 mb-8 overflow-x-auto px-4 print:mx-0 print:overflow-visible print:px-0">
            <table className="mb-0 w-full min-w-[46rem] text-sm print:min-w-0">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Description</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Invoice #</th>
                  <th className="text-right py-2 text-muted-foreground font-medium tabular-nums">Debit</th>
                  <th className="text-right py-2 text-muted-foreground font-medium tabular-nums">Credit</th>
                  <th className="text-right py-2 text-muted-foreground font-medium tabular-nums">Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Balance brought forward — everything before the period start */}
                <tr className="border-b border-border">
                  <td className="py-2.5 text-muted-foreground">{formatDate(from)}</td>
                  <td colSpan={4} className="py-2.5 italic text-muted-foreground">
                    Balance brought forward
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-semibold text-foreground">
                    {formatCurrency(activity.openingBalance)}
                  </td>
                </tr>
                {activity.lines.length > 0 ? (
                  activity.lines.map((line, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-2.5 text-foreground whitespace-nowrap">{formatDate(line.date)}</td>
                      <td className="py-2.5 text-foreground">{lineDescription(line)}</td>
                      <td className="py-2.5 text-muted-foreground font-mono text-xs">{line.number ?? '—'}</td>
                      <td className="py-2.5 text-right tabular-nums text-foreground">
                        {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-foreground">
                        {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-semibold text-foreground">
                        {formatCurrency(line.balance)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b border-border">
                    <td colSpan={6} className="py-6 text-center text-muted-foreground text-sm">
                      No activity in this period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={3} className="pt-3 text-right text-sm text-muted-foreground">
                    Totals for period
                  </td>
                  <td className="pt-3 text-right tabular-nums font-semibold text-foreground">
                    {formatCurrency(activity.totalInvoiced)}
                  </td>
                  <td className="pt-3 text-right tabular-nums font-semibold text-foreground">
                    {formatCurrency(activity.totalPayments + activity.totalCredits)}
                  </td>
                  <td />
                </tr>
                {activity.totalCredits > 0 && (
                  <tr>
                    <td colSpan={6} className="pt-1 text-right text-xs text-muted-foreground">
                      (Payments {formatCurrency(activity.totalPayments)} · Account credits{' '}
                      {formatCurrency(activity.totalCredits)})
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={5} className="pt-2 text-right text-sm font-bold text-foreground">
                    Closing Balance
                  </td>
                  <td className="pt-2 text-right tabular-nums text-lg font-bold text-foreground">
                    {formatCurrency(activity.closingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* ── Open-item table ──────────────────────────────────────────── */
          <>
            {stmt.lines.length > 0 ? (
              <div className="-mx-4 mb-6 overflow-x-auto px-4 print:mx-0 print:overflow-visible print:px-0">
                <table className="mb-0 w-full min-w-[44rem] text-sm print:min-w-0">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Invoice #</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Patient</th>
                      <th className="text-right py-2 text-muted-foreground font-medium tabular-nums">Amount</th>
                      <th className="text-right py-2 text-muted-foreground font-medium tabular-nums">Paid</th>
                      <th className="text-right py-2 text-muted-foreground font-medium tabular-nums">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stmt.lines.map((line) => (
                      <tr key={line.number} className="border-b border-border">
                        <td className="py-2.5 text-foreground">{formatDate(line.date)}</td>
                        <td className="py-2.5 text-foreground font-mono text-xs">{line.number}</td>
                        <td className="py-2.5 text-muted-foreground">{line.patient ?? '—'}</td>
                        <td className="py-2.5 text-right tabular-nums text-foreground">{formatCurrency(line.total)}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                          {line.paid > 0 ? formatCurrency(line.paid) : '—'}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-foreground">
                          {formatCurrency(line.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground text-sm mb-6">
                No outstanding invoices.
              </div>
            )}

            {/* Account totals TO DATE — deliberately separate from the open
                rows, since paid invoices are not listed above but do count into
                these totals. It still renders when there are no open rows, so a
                zero-balance or credit-balance statement is complete. */}
            <OpenStatementTotals stmt={stmt} />

            {/* ── Account credits ledger (open view only — the activity ledger
                   already lists credits as dated lines) ───────────────────── */}
            {stmt.credits.length > 0 && (
              <div className="mb-8">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Account Credits
                </div>
                <div className="-mx-4 overflow-x-auto px-4 print:mx-0 print:overflow-visible print:px-0">
                  <table className="w-full min-w-[36rem] text-sm print:min-w-0">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 text-muted-foreground font-medium">Date</th>
                        <th className="text-left py-1.5 text-muted-foreground font-medium">Reason</th>
                        <th className="text-left py-1.5 text-muted-foreground font-medium">Against</th>
                        <th className="text-right py-1.5 text-muted-foreground font-medium tabular-nums">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stmt.credits.map((c, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="py-2 text-foreground">{formatDate(c.date)}</td>
                          <td className="py-2 text-foreground">Credit — {creditReasonLabel(c.reason)}</td>
                          <td className="py-2 text-muted-foreground font-mono text-xs">{c.number ?? '—'}</td>
                          <td className="py-2 text-right tabular-nums text-foreground">−{formatCurrency(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── A/R Aging — always as-of-today, regardless of the period ────── */}
        {stmt.aging.total > 0 && (
          <div className="mb-8">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              A/R Aging as at {formatDate(today)}
            </div>
            <div className="-mx-4 overflow-x-auto px-4 print:mx-0 print:overflow-visible print:px-0">
              <table className="min-w-[34rem] text-sm print:min-w-0">
                <thead>
                  <tr className="border-b border-border">
                    {(['Current', '1–30 days', '31–60 days', '61–90 days', '90+ days', 'Total'] as const).map((h) => (
                      <th key={h} className="text-right py-1.5 pr-6 last:pr-0 text-muted-foreground font-medium tabular-nums">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[
                      stmt.aging.current,
                      stmt.aging.d1_30,
                      stmt.aging.d31_60,
                      stmt.aging.d61_90,
                      stmt.aging.d90plus,
                      stmt.aging.total,
                    ].map((val, i) => (
                      <td
                        key={i}
                        className={`py-1.5 pr-6 last:pr-0 text-right tabular-nums font-semibold ${
                          i === 4 && val > 0 ? 'text-destructive' : 'text-foreground'
                        }`}
                      >
                        {formatCurrency(val)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <div className="space-y-0.5">
            <div className="font-semibold uppercase tracking-wider mb-1">Payment Details</div>
            <div>Bank: <span className="text-foreground">{billing.bankName}</span></div>
            <div>Account Name: <span className="text-foreground">{billing.accountName}</span></div>
            <div>Account No: <span className="font-mono text-foreground">{billing.accountNumber}</span></div>
            {billing.paymentNote && <div className="mt-1">{billing.paymentNote}</div>}
          </div>
          <div className="sm:text-right">Terms: Net {billing.paymentTermsDays} days</div>
        </div>
      </div>
    </div>
  )
}

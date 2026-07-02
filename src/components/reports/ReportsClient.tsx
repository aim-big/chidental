'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, ChevronDown, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { cn, formatCurrency, formatCompactCurrency, formatDate, todayISODate } from '@/lib/utils'
import { statusBadgeVariant, paymentStatusLabel } from '@/lib/status-badge'
import type { ReportSummary } from '@/lib/reports'
import { avgDaysToPayByClinic } from '@/lib/reports'
import {
  buildSalesReportCsv,
  buildPaymentReportCsv,
  buildItemSalesReportCsv,
  buildSalesSummaryReportCsv,
  salesReportFilename,
  paymentReportFilename,
  itemSalesReportFilename,
  salesSummaryReportFilename,
} from '@/lib/reports-exports'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { ReportPayment } from '@/lib/reports'
import type { PresetMap } from '@/lib/reports-presets'
import { DateRangePicker } from '@/components/date-range-picker'
import { ReportPrintDocument } from './ReportPrintDocument'

const BRAND_CHART = '#766254'
const BRAND_CHART_SOFT = '#9b8779'

// Interactive shell for the reports page. The Server Component fetches + computes
// `summary`; this island renders it and drives the date range through the URL so
// a change re-runs the server query. `isPending` shows the in-flight spinner.
export function ReportsClient({ from, to, summary, presets, payments }: { from: string; to: string; summary: ReportSummary; presets: PresetMap; payments: ReportPayment[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const setRange = (next: { from: string; to: string }) => {
    const params = new URLSearchParams(next)
    startTransition(() => router.push(`/reports?${params.toString()}`, { scroll: false }))
  }

  // Download a CSV string as a file. The leading BOM makes Excel open the UTF-8
  // file with clinic names intact.
  const download = (csv: string, filename: string) => {
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const range = { from, to }
  const exportSummary = () => download(buildSalesSummaryReportCsv(summary.salesSummary, range, todayISODate()), salesSummaryReportFilename(range))
  const exportSales = () => download(buildSalesReportCsv(summary.sales, range, todayISODate()), salesReportFilename(range))
  const exportPayments = () => download(buildPaymentReportCsv(payments, range, todayISODate()), paymentReportFilename(range))
  const exportItems = () => download(buildItemSalesReportCsv(summary.byProduct, range, todayISODate()), itemSalesReportFilename(range))

  const { totalInvoiced, totalPaidInvoices, totalOutstanding, invoiceCount, outstanding, agingBuckets, paid, byProduct, salesSummary } = summary
  // Real cash received in the range (sum of payment rows) — distinct from
  // "Collected (Paid)", which is the full value of paid-status invoices.
  const cashReceived = payments.reduce((s, p) => s + Number(p.amount), 0)
  // Payment speed per clinic (from the payments in this range) for the
  // By Clinic table — surfaces who pays fast and who needs chasing.
  const speedByClinic = avgDaysToPayByClinic(payments)
  const speedRows = Object.values(speedByClinic)
  const overallAvgDaysToPay = speedRows.length > 0
    ? Math.round(
        speedRows.reduce((s, r) => s + r.avgDaysToPay * r.payments, 0) /
        speedRows.reduce((s, r) => s + r.payments, 0),
      )
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Sales Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Revenue and outstanding analysis</p>
      </div>

      {/* Date range picker (shared segmented control) with the Export menu on the right */}
      <DateRangePicker
        from={from}
        to={to}
        presets={presets}
        isPending={isPending}
        onRangeChange={setRange}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              disabled={invoiceCount === 0 && payments.length === 0}
              className="w-full sm:w-auto"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={invoiceCount === 0} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={exportSummary}>Sales Summary</DropdownMenuItem>
                <DropdownMenuItem onSelect={exportSales}>Sales Report</DropdownMenuItem>
                <DropdownMenuItem onSelect={exportPayments}>Payment Report</DropdownMenuItem>
                <DropdownMenuItem onSelect={exportItems}>Item Sales Report</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Print-only document: covers every tab's data for the range */}
      <ReportPrintDocument
        from={from}
        to={to}
        generatedOn={todayISODate()}
        summary={summary}
        payments={payments}
        cashReceived={cashReceived}
        speedByClinic={speedByClinic}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Invoiced</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totalInvoiced)}</p><p className="text-xs text-muted-foreground mt-1">{invoiceCount} invoices</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Collected (Paid)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaidInvoices)}</p><p className="text-xs text-muted-foreground mt-1">value of paid invoices</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalOutstanding)}</p><p className="text-xs text-muted-foreground mt-1">{outstanding.length} unpaid</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cash Received</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(cashReceived)}</p><p className="text-xs text-muted-foreground mt-1">{payments.length} payments in period</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="outstanding">
        <TabsList>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="customers">By Clinic</TabsTrigger>
          <TabsTrigger value="products">By Product</TabsTrigger>
        </TabsList>

        <TabsContent value="outstanding" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Outstanding Invoices</CardTitle></CardHeader>
            <CardContent className="p-0">
              {/* A/R aging at a glance — buckets sum to the Outstanding card */}
              {outstanding.length > 0 && (
                <div className="grid grid-cols-2 gap-3 border-b px-4 pb-4 sm:grid-cols-5 sm:px-6">
                  <AgingBucket label="Not due yet" amount={agingBuckets.current} />
                  <AgingBucket label="1–30 days" amount={agingBuckets.d1_30} toneClass="text-yellow-600" />
                  <AgingBucket label="31–60 days" amount={agingBuckets.d31_60} toneClass="text-orange-500" />
                  <AgingBucket label="61–90 days" amount={agingBuckets.d61_90} toneClass="text-red-600" />
                  <AgingBucket label="Over 90 days" amount={agingBuckets.d90plus} toneClass="text-red-700" />
                </div>
              )}
              <Table className="min-w-[48rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Aging</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outstanding.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No outstanding invoices</TableCell></TableRow>}
                  {outstanding.map(inv => (
                    <TableRow key={inv.id} className="cursor-pointer" onClick={() => router.push(`/invoices/${inv.id}`)}>
                      <TableCell className="font-medium text-primary">{inv.invoice_number}</TableCell>
                      <TableCell className="max-w-[16rem] truncate" title={inv.customers?.clinic_name ?? undefined}>{inv.customers?.clinic_name}</TableCell>
                      <TableCell className="text-sm">{formatDate(inv.due_date)}</TableCell>
                      <TableCell>
                        {inv.daysOverdue > 0 ? (
                          <span className={`text-sm font-medium ${inv.daysOverdue > 60 ? 'text-red-600' : inv.daysOverdue > 30 ? 'text-orange-500' : 'text-yellow-600'}`}>
                            {inv.daysOverdue}d overdue
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not due yet</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(inv.total)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant('payment', inv.status)}>{paymentStatusLabel(inv.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {outstanding.length > 0 && (
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell colSpan={4}>Total</TableCell>
                      <TableCell>{formatCurrency(totalOutstanding)}</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paid" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Paid Invoices</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[42rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paid.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No paid invoices in this period</TableCell></TableRow>}
                  {paid.map(inv => (
                    <TableRow key={inv.id} className="cursor-pointer" onClick={() => router.push(`/invoices/${inv.id}`)}>
                      <TableCell className="font-medium text-primary">{inv.invoice_number}</TableCell>
                      <TableCell className="max-w-[16rem] truncate" title={inv.customers?.clinic_name ?? undefined}>{inv.customers?.clinic_name}</TableCell>
                      <TableCell className="text-sm">{formatDate(inv.invoice_date)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(inv.total)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant('payment', inv.status)}>{paymentStatusLabel(inv.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paid.length > 0 && (
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell>{formatCurrency(totalPaidInvoices)}</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Payments Received</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[42rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payments received in this period</TableCell></TableRow>}
                  {payments.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="font-medium">{p.invoice_number}</TableCell>
                      <TableCell className="max-w-[16rem] truncate" title={p.clinic_name ?? undefined}>{p.clinic_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.reference_number}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {payments.length > 0 && (
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell colSpan={4}>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(cashReceived)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Sales by Clinic (Top 10)</CardTitle></CardHeader>
            <CardContent>
              {salesSummary.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesSummary.slice(0, 10)} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={formatCompactCurrency} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="total" fill={BRAND_CHART} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-6 overflow-x-auto">
                    <p className="text-sm font-medium text-muted-foreground mb-2">All clinics — total sales split by payment status</p>
                    <Table className="min-w-[42rem]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Clinic</TableHead>
                          <TableHead className="text-right">Invoices</TableHead>
                          <TableHead className="text-right">Total Sales</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Outstanding</TableHead>
                          <TableHead className="text-right">Draft</TableHead>
                          <TableHead className="text-right">Avg Days to Pay</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesSummary.map(c => {
                          const speed = speedByClinic[c.name]
                          return (
                            <TableRow key={c.name}>
                              <TableCell className="max-w-[16rem] truncate" title={c.name}>{c.name}</TableCell>
                              <TableCell className="text-right">{c.count}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(c.total)}</TableCell>
                              <TableCell className="text-right text-green-600">{formatCurrency(c.paid)}</TableCell>
                              <TableCell className="text-right text-yellow-600">{formatCurrency(c.outstanding)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{formatCurrency(c.draft)}</TableCell>
                              <TableCell className="text-right" title={speed ? `from ${speed.payments} payment${speed.payments === 1 ? '' : 's'} in this period` : 'no payments in this period'}>
                                {speed ? `${speed.avgDaysToPay}d` : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        <TableRow className="border-t-2 font-semibold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{salesSummary.reduce((s, c) => s + c.count, 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(salesSummary.reduce((s, c) => s + c.total, 0))}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(salesSummary.reduce((s, c) => s + c.paid, 0))}</TableCell>
                          <TableCell className="text-right text-yellow-600">{formatCurrency(salesSummary.reduce((s, c) => s + c.outstanding, 0))}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatCurrency(salesSummary.reduce((s, c) => s + c.draft, 0))}</TableCell>
                          <TableCell className="text-right">{overallAvgDaysToPay != null ? `${overallAvgDaysToPay}d` : '—'}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : <p className="text-center text-muted-foreground py-8">No data for this period</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Revenue by Product (Top 10)</CardTitle></CardHeader>
            <CardContent>
              {byProduct.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={byProduct.slice(0, 10)} layout="vertical" margin={{ left: 160 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={formatCompactCurrency} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="total" fill={BRAND_CHART_SOFT} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-6 overflow-x-auto">
                    <p className="text-sm font-medium text-muted-foreground mb-2">All products</p>
                    <Table className="min-w-[28rem]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {byProduct.map(p => (
                          <TableRow key={p.name}>
                            <TableCell className="max-w-[16rem] truncate" title={p.name}>{p.name}</TableCell>
                            <TableCell className="text-right">{p.qty}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(p.total)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 font-semibold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{byProduct.reduce((s, p) => s + p.qty, 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(byProduct.reduce((s, p) => s + p.total, 0))}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : <p className="text-center text-muted-foreground py-8">No data for this period</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// One A/R aging bucket — the amount owed in an age band of the Outstanding tab.
function AgingBucket({ label, amount, toneClass }: { label: string; amount: number; toneClass?: string }) {
  const empty = amount <= 0
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', empty ? 'text-muted-foreground/50' : toneClass)}>
        {formatCurrency(amount)}
      </p>
    </div>
  )
}

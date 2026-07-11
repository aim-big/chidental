// Customer detail — server-first. This Server Component fetches the customer +
// its invoices via `getCustomerDetail`, derives the billing totals, and renders
// the static contact/summary cards server-side. The interactive header (back +
// gated Edit/New) and the clickable invoice history are client islands.

import { notFound, redirect } from 'next/navigation'
import { getCustomerDetail } from '@/data/customers'
import { getCreditsForCustomer } from '@/data/credits'
import { requirePermission } from '@/lib/auth/require-permission'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Metric } from '@/components/ui/metric'
import { Money, formatMYR } from '@/components/ui/money'
import { formatDate, todayISODate } from '@/lib/utils'
import { summarizeCustomerInvoices, arAging } from '@chidental/shared'
import { creditReasonLabel } from '@/lib/credit'
import { MapPin, Truck } from 'lucide-react'
import { CustomerDetailHeader } from '@/components/customers/CustomerDetailHeader'
import { CustomerContactChannels } from '@/components/customers/CustomerContactChannels'
import { CustomerInvoiceHistory } from '@/components/customers/CustomerInvoiceHistory'
import { IssueCreditDialog } from '@/components/customers/IssueCreditDialog'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('customers.view')
  if (gate.ok === false) redirect('/dashboard')

  const { id } = await params
  const [data, credits] = await Promise.all([getCustomerDetail(id), getCreditsForCustomer(id)])
  if (!data) notFound()

  const { customer, invoices } = data
  const { totalBilled, totalOutstanding } = summarizeCustomerInvoices(invoices)
  const aging = arAging(invoices, todayISODate())

  // A credit is a non-payment reduction of the clinic's account. The account
  // balance nets credits OUT explicitly; the A/R aging buckets stay payment-based
  // and unchanged (credits never get allocated into 0–30/31–60/… buckets).
  const totalCredits = credits.reduce((s, c) => s + Number(c.amount), 0)
  const accountBalance = totalOutstanding - totalCredits
  const hasContactChannels = Boolean(customer.phone || customer.email)
  const hasAddresses = Boolean(customer.billing_address || customer.delivery_address)

  // The "against invoice" picker offers the clinic's invoices, newest-first
  // (getCustomerDetail already returns them in that order).
  const invoiceOptions = invoices.map((inv) => ({ id: inv.id, invoice_number: inv.invoice_number }))

  return (
    <div className="w-full max-w-5xl space-y-6">
      <CustomerDetailHeader id={id} clinicName={customer.clinic_name} contactPerson={customer.contact_person} archivedAt={customer.archived_at} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Contact Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {hasContactChannels && (
              <CustomerContactChannels phone={customer.phone} email={customer.email} />
            )}
            {hasContactChannels && hasAddresses && (
              <Separator />
            )}
            {customer.billing_address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Billing Address</p>
                  <span className="whitespace-pre-line">{customer.billing_address}</span>
                </div>
              </div>
            )}
            {customer.delivery_address && (
              <div className="flex items-start gap-2 text-sm">
                <Truck className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Delivery Address</p>
                  <span className="whitespace-pre-line">{customer.delivery_address}</span>
                </div>
              </div>
            )}
            {customer.notes && (
              <>
                <Separator />
                <p className="text-sm text-muted-foreground italic">{customer.notes}</p>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Money summary — the balance owed is the dominant figure; total billed and
              account credits are supporting lines, so the netting (outstanding − credits)
              stays legible rather than fighting the hero for weight. */}
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <Metric
                hero
                tone={accountBalance > 0 ? 'warning' : 'success'}
                label={totalCredits > 0 ? 'Balance owed' : 'Outstanding'}
                value={<Money amount={accountBalance} />}
                hint={accountBalance <= 0 ? 'Fully settled' : undefined}
              />
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                <Metric label="Total billed" value={<Money amount={totalBilled} />} />
                {totalCredits > 0 && (
                  <>
                    <Metric label="Outstanding" value={<Money amount={totalOutstanding} />} />
                    <Metric label="Account credits" value={<Money>{`−${formatMYR(totalCredits)}`}</Money>} />
                  </>
                )}
              </div>
              <div className="pt-1">
                <IssueCreditDialog customerId={id} invoices={invoiceOptions} />
              </div>
            </CardContent>
          </Card>
          {credits.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Account Credits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {credits.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-foreground">Credit — {creditReasonLabel(c.reason)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(c.credit_date)}</p>
                    </div>
                    <Money className="font-medium">{`−${formatMYR(Number(c.amount))}`}</Money>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {totalOutstanding > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">A/R Aging</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {[
                  { label: 'Current', value: aging.current },
                  { label: '1–30 days', value: aging.d1_30 },
                  { label: '31–60 days', value: aging.d31_60 },
                  { label: '61–90 days', value: aging.d61_90 },
                  { label: '90+ days', value: aging.d90plus, danger: true },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{row.label}</span>
                    <Money
                      amount={row.value}
                      tone={row.danger && row.value > 0 ? 'danger' : 'default'}
                      className="font-medium"
                    />
                  </div>
                ))}
                {/* Credits are NOT bucketed by age — aging stays payment-based.
                    Show the total as a separate adjustment beneath the table. */}
                {totalCredits > 0 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Less: account credits</span>
                      <Money className="font-medium">{`−${formatMYR(totalCredits)}`}</Money>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CustomerInvoiceHistory invoices={invoices} />
    </div>
  )
}

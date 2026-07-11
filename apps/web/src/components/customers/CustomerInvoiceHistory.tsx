'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Money } from '@/components/ui/money'
import { StatusPill, statusTone } from '@/components/ui/status-pill'
import { formatDate } from '@/lib/utils'
import { isVoided } from '@chidental/shared'
import { paymentStatusLabel } from '@/lib/status-badge'
import type { Invoice } from '@chidental/shared'

// Read-only invoice history for a customer, with rows that navigate to the
// invoice. Client island only because the rows are clickable; the data is
// fetched server-side and passed in.
export function CustomerInvoiceHistory({ invoices }: { invoices: Invoice[] }) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Invoice History</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-[38rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No invoices yet</TableCell></TableRow>
            )}
            {invoices.map(inv => (
              <TableRow key={inv.id} className="cursor-pointer" onClick={() => router.push(`/invoices/${inv.id}`)}>
                <TableCell className="font-medium text-brand">{inv.invoice_number}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDate(inv.invoice_date)}</TableCell>
                <TableCell className="font-medium"><Money amount={Number(inv.total)} /></TableCell>
                <TableCell>
                  {isVoided(inv)
                    ? <StatusPill tone="danger">Voided</StatusPill>
                    : <StatusPill tone={statusTone('payment', inv.status)}>{paymentStatusLabel(inv.status)}</StatusPill>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// Server-side READ query functions for the customers module.
//
// These run inside Server Components via the SSR client (`await createClient()`),
// which is RLS-aware through the session cookie. They mirror, verbatim, the
// queries the current client pages run today — same `.select(...)` strings and
// ordering — so the move to server-first rendering is behavior-preserving.
//
// Writes live in `./customer-actions.ts`.

import { createClient } from '@/lib/supabase/server'
import type { Customer, Invoice } from '@/lib/database.types'
import type { StatementInvoiceRow, StatementPaymentRow } from '@/lib/statement'

// The bundle the detail page needs: the customer plus its invoice history.
export type CustomerDetail = {
  customer: Customer
  invoices: Invoice[]
}

// List query — mirrors `customers/page.tsx`:
//   .select('*').order('clinic_name')
export async function getCustomers(): Promise<Customer[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('customers').select('*').order('clinic_name')
  return (data ?? []) as Customer[]
}

// Detail bundle — mirrors the 2 parallel reads in `[id]/page.tsx`. Returns
// `null` when the customer row is missing.
export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const supabase = await createClient()
  const [cRes, iRes] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase.from('invoices').select('*').eq('customer_id', id).order('invoice_date', { ascending: false }),
  ])
  if (!cRes.data) return null
  return {
    customer: cRes.data as Customer,
    invoices: (iRes.data ?? []) as Invoice[],
  }
}

// Statement bundle — fetches the clinic row, its non-voided invoices (fields
// needed by buildStatement), and all payment rows for those invoices. Returns
// `null` when the clinic row is missing.
export type ClinicStatementBundle = {
  clinic: Customer
  invoices: StatementInvoiceRow[]
  payments: StatementPaymentRow[]
}

export async function getClinicStatement(id: string): Promise<ClinicStatementBundle | null> {
  const supabase = await createClient()

  // Fetch clinic + non-voided invoices in parallel
  const [cRes, iRes] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, due_date, patient, total, status, voided_at')
      .eq('customer_id', id)
      .is('voided_at', null)
      .order('invoice_date', { ascending: true }),
  ])

  if (!cRes.data) return null

  const invoices = (iRes.data ?? []) as StatementInvoiceRow[]

  // Fetch payments for these invoices (empty result set if no invoices)
  let payments: StatementPaymentRow[] = []
  if (invoices.length > 0) {
    const invoiceIds = invoices.map((i) => i.id)
    const { data: pData } = await supabase
      .from('payments')
      .select('invoice_id, amount')
      .in('invoice_id', invoiceIds)
    payments = (pData ?? []) as StatementPaymentRow[]
  }

  return {
    clinic: cRes.data as Customer,
    invoices,
    payments,
  }
}

// Edit-mode prefill — mirrors `CustomerForm`'s edit-mode read. Returns `null`
// when the customer row is missing.
export async function getCustomerForEdit(id: string): Promise<Customer | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('customers').select('*').eq('id', id).single()
  return (data ?? null) as Customer | null
}

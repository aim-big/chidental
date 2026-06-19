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

// Edit-mode prefill — mirrors `CustomerForm`'s edit-mode read. Returns `null`
// when the customer row is missing.
export async function getCustomerForEdit(id: string): Promise<Customer | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('customers').select('*').eq('id', id).single()
  return (data ?? null) as Customer | null
}

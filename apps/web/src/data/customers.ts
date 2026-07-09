// Server-side READ query functions for the customers module.
//
// The customers module is served entirely by the NestJS API. Each function is a
// thin, typed proxy over an API endpoint; the signatures are unchanged so the
// components that call them are untouched.
//
// Writes live in `./customer-actions.ts`.

import { apiGet, apiGetOrNull } from '@/lib/api/client'
import type { Customer, Invoice } from '@chidental/shared'
import type { StatementInvoiceRow, ActivityPaymentRow, StatementCreditRow } from '@/lib/statement'

// The bundle the detail page needs: the customer plus its invoice history.
export type CustomerDetail = {
  customer: Customer
  invoices: Invoice[]
}

// List query: active (non-archived) clinics, clinic_name asc.
export async function getCustomers(): Promise<Customer[]> {
  return apiGet<Customer[]>('/customers')
}

// --- Paginated list (URL-driven) -------------------------------------------

// The clinics list active/archived filter rides the `view` URL slot.
export type CustomerView = 'active' | 'archived' | 'all'

export interface CustomerListParams {
  q?: string
  page?: number
  pageSize?: number
  sort?: string | null
  dir?: 'asc' | 'desc'
  view?: CustomerView
}

export interface CustomerListPage {
  rows: Customer[]
  total: number
  page: number
  totalPages: number
  pageStart: number
  pageEnd: number
}

/** URL-driven clinics list: server-side search + sort + pagination. */
export async function getCustomersPage(params: CustomerListParams = {}): Promise<CustomerListPage> {
  const { q = '', page = 1, pageSize = 15, sort = null, dir = 'asc', view = 'active' } = params
  const qs = new URLSearchParams({ q, view, page: String(page), pageSize: String(pageSize), dir })
  if (sort) qs.set('sort', sort)
  return apiGet<CustomerListPage>(`/customers/page?${qs.toString()}`)
}

// Detail bundle — the customer plus its invoice history. `null` when missing.
export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  return apiGetOrNull<CustomerDetail>(`/customers/${id}/detail`)
}

// Statement bundle — clinic + non-voided invoices + payments + credits. `null`
// when the clinic row is missing.
export type ClinicStatementBundle = {
  clinic: Customer
  invoices: StatementInvoiceRow[]
  payments: ActivityPaymentRow[]
  credits: StatementCreditRow[]
}

export async function getClinicStatement(id: string): Promise<ClinicStatementBundle | null> {
  return apiGetOrNull<ClinicStatementBundle>(`/customers/${id}/statement`)
}

// Edit-mode prefill — a single clinic row. `null` when missing.
export async function getCustomerForEdit(id: string): Promise<Customer | null> {
  return apiGetOrNull<Customer>(`/customers/${id}`)
}

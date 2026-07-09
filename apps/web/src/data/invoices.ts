// Server-side READ query functions for the invoices module.
//
// The invoices module is served entirely by the NestJS API. Each function is a
// thin, typed proxy over an API endpoint; the signatures are unchanged so the
// components that call them are untouched.
//
// Writes live in `./invoice-actions.ts`.

import { apiGet, apiGetOrNull } from '@/lib/api/client'
import type {
  Invoice,
  InvoiceItem,
  InvoiceItemStatusHistory,
  Payment,
  Customer,
  Product,
  ServiceStatus,
  WorkStage,
  WorkStatusConfig,
} from '@chidental/shared'

// --- Return types ----------------------------------------------------------

export type InvoiceListRow = Invoice & {
  customers?: { clinic_name: string } | null
  service_statuses?: ServiceStatus | null
}

export type InvoiceDetail = Invoice & {
  customers?: Customer | null
  service_statuses?: ServiceStatus | null
}

export type InvoiceDetailBundle = {
  invoice: InvoiceDetail
  items: InvoiceItem[]
  payments: Payment[]
  history: InvoiceItemStatusHistory[]
  products: Product[]
  stages: WorkStage[]
  workStatusConfigs: WorkStatusConfig[]
  serviceStatuses: ServiceStatus[]
}

export type InvoiceFormData = {
  customers: Customer[]
  products: Product[]
  serviceStatuses: ServiceStatus[]
  /** Lab's standard payment terms (days) — derives a new invoice's due date. */
  paymentTermsDays: number
}

export type InvoiceForEdit = {
  invoice: Invoice
  items: InvoiceItem[]
}

// --- Queries ---------------------------------------------------------------

// List query: newest-first, non-deleted (capped server-side).
export async function getInvoices(): Promise<InvoiceListRow[]> {
  return apiGet<InvoiceListRow[]>('/invoices')
}

// --- Paginated list (URL-driven) -------------------------------------------

export type InvoiceView = 'all' | 'drafts' | 'unpaid' | 'voided'

export interface InvoiceListParams {
  q?: string
  view?: InvoiceView
  page?: number
  pageSize?: number
  sort?: string | null
  dir?: 'asc' | 'desc'
}

export interface InvoiceListPage {
  rows: InvoiceListRow[]
  total: number
  page: number
  totalPages: number
  pageStart: number
  pageEnd: number
}

/** URL-driven invoices list: server-side search + view filter + sort, paginated. */
export async function getInvoicesPage(params: InvoiceListParams = {}): Promise<InvoiceListPage> {
  const { q = '', view = 'all', page = 1, pageSize = 15, sort = null, dir = 'asc' } = params
  const qs = new URLSearchParams({ q, view, page: String(page), pageSize: String(pageSize), dir })
  if (sort) qs.set('sort', sort)
  return apiGet<InvoiceListPage>(`/invoices/page?${qs.toString()}`)
}

/** Per-view counts for the saved-view tabs. */
export async function getInvoiceViewCounts(): Promise<Record<InvoiceView, number>> {
  return apiGet<Record<InvoiceView, number>>('/invoices/view-counts')
}

// Detail bundle — the invoice header + items + payments + history + reference
// data. `null` when the invoice row is missing.
export async function getInvoiceDetail(id: string): Promise<InvoiceDetailBundle | null> {
  return apiGetOrNull<InvoiceDetailBundle>(`/invoices/${id}/detail`)
}

export async function getWorkStatusConfigs(): Promise<WorkStatusConfig[]> {
  return apiGet<WorkStatusConfig[]>('/invoices/work-status-configs')
}

// Reference data the create/edit form needs on mount.
export async function getInvoiceFormData(
  opts?: { includeCustomerId?: string },
): Promise<InvoiceFormData> {
  const qs = opts?.includeCustomerId
    ? `?includeCustomerId=${encodeURIComponent(opts.includeCustomerId)}`
    : ''
  return apiGet<InvoiceFormData>(`/invoices/form-data${qs}`)
}

// Edit-mode prefill — the invoice header + its line items. `null` when missing.
export async function getInvoiceForEdit(id: string): Promise<InvoiceForEdit | null> {
  return apiGetOrNull<InvoiceForEdit>(`/invoices/${id}/edit`)
}

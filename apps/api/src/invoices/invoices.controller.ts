import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'

// Read endpoints for the invoices module (strangler migration, module 4).
// Mirrors apps/web `src/data/invoices.ts` verbatim (same .select strings,
// ordering, and the JS search/sort/paginate passes). Every table this touches
// (invoices, customers, service_statuses, invoice_items, payments,
// invoice_item_status_history, products, work_stages, work_status_configs,
// lab_billing_settings) has a `using (true)` read policy, so the service-role
// client returns the same rows the RLS session client does. The global guard's
// valid-session check is the gate.
//
// Route order: static routes (page/view-counts/form-data/work-status-configs)
// are declared before the two-segment `:id/*` routes.

const INVOICE_SELECT = '*, customers(clinic_name), service_statuses(*)'
const OUTSTANDING = ['sent', 'partial', 'overdue']

// Pure slice + clamp — mirrors apps/web `@/lib/pagination` paginate().
function paginate<T>(items: T[], page: number, pageSize: number) {
  pageSize = Math.max(1, pageSize)
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const clamped = Math.min(Math.max(1, page), totalPages)
  const startIndex = (clamped - 1) * pageSize
  const pageItems = items.slice(startIndex, startIndex + pageSize)
  return {
    pageItems,
    page: clamped,
    totalPages,
    pageStart: total === 0 ? 0 : startIndex + 1,
    pageEnd: startIndex + pageItems.length,
  }
}

// Mirrors apps/web INVOICE_SORTERS.
type Row = {
  invoice_number: string
  patient: string | null
  invoice_date: string | null
  total: number | string
  voided_at: string | null
  status: string
  customers?: { clinic_name: string } | null
}
const SORTERS: Record<string, (r: Row) => string | number> = {
  number: (r) => r.invoice_number.toLowerCase(),
  customer: (r) => (r.customers?.clinic_name ?? '').toLowerCase(),
  patient: (r) => (r.patient ?? '').toLowerCase(),
  date: (r) => r.invoice_date ?? '',
  amount: (r) => Number(r.total),
}

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly supabase: SupabaseService) {}

  // Mirrors getInvoices(): newest-first, non-deleted, capped at 1000.
  @Get()
  async list() {
    const { data, error } = await this.supabase.admin
      .from('invoices')
      .select(INVOICE_SELECT)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // Mirrors getInvoicesPage(): SQL view filter + SQL number/patient search, then
  // JS clinic-name widen + JS sort + JS paginate. Same InvoiceListPage shape.
  @Get('page')
  async page(
    @Query('q') q = '',
    @Query('view') view: 'all' | 'drafts' | 'unpaid' | 'voided' = 'all',
    @Query('page') pageRaw = '1',
    @Query('pageSize') pageSizeRaw = '15',
    @Query('sort') sort: string | null = null,
    @Query('dir') dir: 'asc' | 'desc' = 'asc',
  ) {
    const pageSize = Math.max(1, Number(pageSizeRaw) || 15)
    const page = Math.max(1, Number(pageRaw) || 1)

    let query = this.supabase.admin
      .from('invoices')
      .select(INVOICE_SELECT)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (view === 'voided') {
      query = query.not('voided_at', 'is', null)
    } else {
      query = query.is('voided_at', null)
      if (view === 'drafts') query = query.eq('status', 'draft')
      else if (view === 'unpaid') query = query.in('status', OUTSTANDING)
    }

    const term = q.trim()
    if (term) {
      const safe = term.replace(/[%,]/g, ' ')
      query = query.or(`invoice_number.ilike.%${safe}%,patient.ilike.%${safe}%`)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    let rows = (data ?? []) as unknown as Row[]

    // Clinic-name search (embedded relation) — JS widen over the SQL results.
    if (term) {
      const lc = term.toLowerCase()
      rows = rows.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(lc) ||
          (inv.patient ?? '').toLowerCase().includes(lc) ||
          (inv.customers?.clinic_name ?? '').toLowerCase().includes(lc),
      )
    }

    const sorter = sort ? SORTERS[sort] : undefined
    if (sorter) {
      rows = [...rows].sort((a, b) => {
        const av = sorter(a)
        const bv = sorter(b)
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return dir === 'desc' ? -cmp : cmp
      })
    }

    const total = rows.length
    const sliced = paginate(rows, page, pageSize)
    return {
      rows: sliced.pageItems,
      total,
      page: sliced.page,
      totalPages: sliced.totalPages,
      pageStart: sliced.pageStart,
      pageEnd: sliced.pageEnd,
    }
  }

  // Mirrors getInvoiceViewCounts(): per-view totals counted in JS.
  @Get('view-counts')
  async viewCounts() {
    const { data, error } = await this.supabase.admin
      .from('invoices')
      .select(INVOICE_SELECT)
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    const all = (data ?? []) as unknown as Row[]
    const isVoided = (i: Row) => i.voided_at != null
    return {
      all: all.length,
      drafts: all.filter((i) => !isVoided(i) && i.status === 'draft').length,
      unpaid: all.filter((i) => !isVoided(i) && OUTSTANDING.includes(i.status)).length,
      voided: all.filter((i) => isVoided(i)).length,
    }
  }

  // Mirrors getInvoiceFormData(): active clinics (+ optional includeCustomerId),
  // active products, active service statuses, and the lab's payment terms.
  @Get('form-data')
  async formData(@Query('includeCustomerId') includeCustomerId?: string) {
    let customersQuery = this.supabase.admin.from('customers').select('*')
    customersQuery = includeCustomerId
      ? customersQuery.or(`archived_at.is.null,id.eq.${includeCustomerId}`)
      : customersQuery.is('archived_at', null)
    customersQuery = customersQuery.order('clinic_name')

    const [cRes, pRes, ssRes, bRes] = await Promise.all([
      customersQuery,
      this.supabase.admin.from('products').select('*').eq('active', true).order('created_at'),
      this.supabase.admin
        .from('service_statuses')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('label'),
      this.supabase.admin
        .from('lab_billing_settings')
        .select('payment_terms_days')
        .eq('id', 'default')
        .maybeSingle(),
    ])

    // Mirrors billingSettingsFromRow: payment_terms_days ?? default (30).
    const paymentTermsDays = bRes.data?.payment_terms_days ?? 30

    return {
      customers: cRes.data ?? [],
      products: pRes.data ?? [],
      serviceStatuses: ssRes.data ?? [],
      paymentTermsDays,
    }
  }

  // Mirrors getWorkStatusConfigs(): configs ordered by sort_order.
  @Get('work-status-configs')
  async workStatusConfigs() {
    const { data, error } = await this.supabase.admin
      .from('work_status_configs')
      .select('*')
      .order('sort_order')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // Mirrors getInvoiceDetail(): the 7 parallel reads + the dependent history
  // read. 404 when the invoice row is missing (web returns null).
  @Get(':id/detail')
  async detail(@Param('id') id: string) {
    const [invRes, itemsRes, paymentsRes, ssRes, prodRes, stagesRes, statusConfigsRes] =
      await Promise.all([
        this.supabase.admin
          .from('invoices')
          .select('*, customers(*), service_statuses(*)')
          .eq('id', id)
          .is('deleted_at', null)
          .single(),
        this.supabase.admin
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', id)
          .order('sort_order')
          .order('created_at'),
        this.supabase.admin.from('payments').select('*').eq('invoice_id', id).order('payment_date'),
        this.supabase.admin
          .from('service_statuses')
          .select('*')
          .eq('is_active', true)
          .order('sort_order')
          .order('label'),
        this.supabase.admin.from('products').select('*').eq('active', true).order('created_at'),
        this.supabase.admin.from('work_stages').select('*').order('sort_order').order('label'),
        this.supabase.admin.from('work_status_configs').select('*').order('sort_order'),
      ])

    if (!invRes.data) throw new NotFoundException('invoice not found')

    const items = (itemsRes.data ?? []) as Array<{ id: string }>

    let history: unknown[] = []
    if (items.length > 0) {
      const { data: histRows } = await this.supabase.admin
        .from('invoice_item_status_history')
        .select('*')
        .in(
          'invoice_item_id',
          items.map((i) => i.id),
        )
        .order('changed_at', { ascending: false })
      history = histRows ?? []
    }

    return {
      invoice: invRes.data,
      items,
      payments: paymentsRes.data ?? [],
      history,
      products: prodRes.data ?? [],
      stages: stagesRes.data ?? [],
      workStatusConfigs: statusConfigsRes.data ?? [],
      serviceStatuses: ssRes.data ?? [],
    }
  }

  // Mirrors getInvoiceForEdit(): invoice header + its line items. 404 when
  // the invoice row is missing.
  @Get(':id/edit')
  async edit(@Param('id') id: string) {
    const [invRes, itemsRes] = await Promise.all([
      this.supabase.admin
        .from('invoices')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single(),
      this.supabase.admin
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id)
        .order('sort_order')
        .order('created_at'),
    ])
    if (!invRes.data) throw new NotFoundException('invoice not found')
    return { invoice: invRes.data, items: itemsRes.data ?? [] }
  }
}

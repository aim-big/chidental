import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common'
import { customerInputSchema, idSchema, type CustomerInput } from '@chidental/shared'
import { SupabaseService } from '../supabase/supabase.service'
import { RequirePermission } from '../auth/require-permission.decorator'

// Map validated input to the DB row — mirrors apps/web customer-actions.ts toRow:
// empty strings collapse to null so optional columns stay clean.
function toRow(input: CustomerInput) {
  return {
    clinic_name: input.clinic_name,
    ssm_no: input.ssm_no || null,
    contact_person: input.contact_person || null,
    phone: input.phone || null,
    email: input.email || null,
    billing_address: input.billing_address || null,
    delivery_address: input.delivery_address || null,
    notes: input.notes || null,
  }
}

// Read endpoints for the customers module (strangler migration, module 2).
// Mirrors apps/web `src/data/customers.ts` verbatim (same .select/.order/.filter
// strings). Any authenticated user may read clinics — the web RLS is
// `customers_read ... using (true)` (likewise invoices/payments/credits), so the
// service-role client is behaviour-preserving; the global guard's valid-session
// check is the gate. No @RequirePermission here.
//
// Route order: the static `page` route and the two-segment `:id/detail` /
// `:id/statement` routes are declared before the bare `:id` route so Express
// never captures them as an id.
const SORT_COLUMNS: Record<string, string> = {
  clinic: 'clinic_name',
  contact: 'contact_person',
  registered: 'created_at',
}

@Controller('customers')
export class CustomersController {
  constructor(private readonly supabase: SupabaseService) {}

  // Mirrors getCustomers(): active (archived_at null) clinics, clinic_name asc.
  @Get()
  async list() {
    const { data, error } = await this.supabase.admin
      .from('customers')
      .select('*')
      .is('archived_at', null)
      .order('clinic_name')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // Mirrors getCustomersPage(): view filter + search + sort + pagination via
  // .order().range() with an exact count. Same shape as CustomerListPage.
  @Get('page')
  async page(
    @Query('q') q = '',
    @Query('view') view: 'active' | 'archived' | 'all' = 'active',
    @Query('page') pageRaw = '1',
    @Query('pageSize') pageSizeRaw = '15',
    @Query('sort') sort: string | null = null,
    @Query('dir') dir: 'asc' | 'desc' = 'asc',
  ) {
    const pageSize = Math.max(1, Number(pageSizeRaw) || 15)
    const page = Math.max(1, Number(pageRaw) || 1)
    const sortCol = (sort && SORT_COLUMNS[sort]) || 'clinic_name'

    let query = this.supabase.admin
      .from('customers')
      .select('*', { count: 'exact' })
      .order(sortCol, { ascending: dir !== 'desc' })

    if (view === 'active') query = query.is('archived_at', null)
    else if (view === 'archived') query = query.not('archived_at', 'is', null)

    const term = q.trim()
    if (term) {
      const safe = term.replace(/[%,]/g, ' ')
      query = query.or(
        `clinic_name.ilike.%${safe}%,contact_person.ilike.%${safe}%,phone.ilike.%${safe}%`,
      )
    }

    const from = (page - 1) * pageSize
    const { data, count, error } = await query.range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)

    const total = count ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const rows = data ?? []
    return {
      rows,
      total,
      page: Math.min(page, totalPages),
      totalPages,
      pageStart: total === 0 ? 0 : from + 1,
      pageEnd: from + rows.length,
    }
  }

  // Mirrors getCustomerDetail(): clinic + its non-deleted invoices (newest first).
  // 404 when the clinic row is missing (web returns null → apiGetOrNull maps it).
  @Get(':id/detail')
  async detail(@Param('id') id: string) {
    const [cRes, iRes] = await Promise.all([
      this.supabase.admin.from('customers').select('*').eq('id', id).single(),
      this.supabase.admin
        .from('invoices')
        .select('*')
        .eq('customer_id', id)
        .is('deleted_at', null)
        .order('invoice_date', { ascending: false }),
    ])
    if (!cRes.data) throw new NotFoundException('customer not found')
    return { customer: cRes.data, invoices: iRes.data ?? [] }
  }

  // Mirrors getClinicStatement(): clinic + non-voided invoices + credits + the
  // payments for those invoices. 404 when the clinic row is missing.
  @Get(':id/statement')
  async statement(@Param('id') id: string) {
    const [cRes, iRes, crRes] = await Promise.all([
      this.supabase.admin.from('customers').select('*').eq('id', id).single(),
      this.supabase.admin
        .from('invoices')
        .select('id, invoice_number, invoice_date, due_date, patient, total, status, voided_at')
        .eq('customer_id', id)
        .is('voided_at', null)
        .is('deleted_at', null)
        .order('invoice_date', { ascending: true }),
      this.supabase.admin
        .from('credits')
        .select('credit_date, amount, reason, invoice_id')
        .eq('customer_id', id)
        .order('credit_date', { ascending: true }),
    ])
    if (!cRes.data) throw new NotFoundException('customer not found')

    const invoices = iRes.data ?? []
    const credits = crRes.data ?? []

    let payments: unknown[] = []
    if (invoices.length > 0) {
      const invoiceIds = invoices.map((i) => i.id)
      const { data: pData } = await this.supabase.admin
        .from('payments')
        .select('invoice_id, amount, payment_date, reference_number')
        .in('invoice_id', invoiceIds)
      payments = pData ?? []
    }

    return { clinic: cRes.data, invoices, payments, credits }
  }

  // Mirrors getCustomerForEdit(): a single clinic row. 404 when missing.
  @Get(':id')
  async edit(@Param('id') id: string) {
    const { data } = await this.supabase.admin
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()
    if (!data) throw new NotFoundException('customer not found')
    return data
  }

  // --- Writes (strangler module 7: customer-actions) ------------------------
  // Each mirrors apps/web `src/data/customer-actions.ts` and gates on
  // customers.edit (same key the UI uses). The global guard enforces the
  // permission (403 → the seam maps it to the exact string); validation + DB
  // outcomes are returned as a 200 ActionResult body so their messages pass
  // through verbatim. `revalidatePath` stays in the web action.

  // Mirrors createCustomerAction(): validate → insert → { ok, id }.
  @Post()
  @RequirePermission('customers.edit')
  async create(@Body() body: unknown) {
    const parsed = customerInputSchema.safeParse(body)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    const { data, error } = await this.supabase.admin
      .from('customers')
      .insert(toRow(parsed.data))
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, id: data.id as string }
  }

  // Mirrors updateCustomerAction(): validate id + input → update → { ok }.
  @Patch(':id')
  @RequirePermission('customers.edit')
  async update(@Param('id') id: string, @Body() body: unknown) {
    if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid clinic id' }
    const parsed = customerInputSchema.safeParse(body)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    const { error } = await this.supabase.admin.from('customers').update(toRow(parsed.data)).eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  // Mirrors archiveCustomerAction(): soft-delete via archived_at = now().
  @Post(':id/archive')
  @RequirePermission('customers.edit')
  async archive(@Param('id') id: string) {
    if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid clinic id' }
    const { error } = await this.supabase.admin
      .from('customers')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  // Mirrors restoreCustomerAction(): clear archived_at.
  @Post(':id/restore')
  @RequirePermission('customers.edit')
  async restore(@Param('id') id: string) {
    if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid clinic id' }
    const { error } = await this.supabase.admin.from('customers').update({ archived_at: null }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }
}

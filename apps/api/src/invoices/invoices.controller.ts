import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common'
import {
  createInvoiceInputSchema,
  updateInvoiceInputSchema,
  recordPaymentInputSchema,
  caseDetailsSchema,
  serviceStatusInputSchema,
  recipientFieldsSchema,
  idSchema,
  invoiceMoneyError,
} from '@chidental/shared'
import { SupabaseService } from '../supabase/supabase.service'
import { RequirePermission } from '../auth/require-permission.decorator'
import { Auth } from '../auth/auth-context.decorator'
import { PermissionsService, type AuthContext } from '../auth/permissions.service'
import { ActivityLogService } from '../audit/activity-log.service'
import { BillingSnapshotService } from './billing-snapshot.service'
import { diffFields, INVOICE_FIELD_LABELS, RECIPIENT_FIELD_LABELS } from './audit-diff'

type Ok = { ok: true } | { ok: true; id: string }
type Fail = { ok: false; error: string }
type Res = Ok | Fail

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
  constructor(
    private readonly supabase: SupabaseService,
    private readonly permissions: PermissionsService,
    private readonly activity: ActivityLogService,
    private readonly billing: BillingSnapshotService,
  ) {}

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

  // --- Writes (strangler module 9: invoice-actions — money + audit) ---------
  // Each mirrors apps/web `src/data/invoice-actions.ts` verbatim: same Zod
  // schema, same money cross-check, same RPCs (which take the actor as a param —
  // no auth.uid() dependency, so the admin client is correct), same activity
  // rows, same permission gating. `revalidatePath` stays in the web action.

  // Content-edit gate — replicates gateForContentEdit: voided → locked for
  // everyone; drafts need invoices.edit, sent/others need invoices.manage. The
  // required permission depends on invoice STATE, so it can't be a static
  // @RequirePermission; it's resolved here from the DB + the AuthContext.
  private async gateContentEdit(id: string, ctx: AuthContext): Promise<Res> {
    const { data, error } = await this.supabase.admin
      .from('invoices')
      .select('status, voided_at')
      .eq('id', id)
      .single()
    if (error || !data) return { ok: false, error: error?.message ?? 'Invoice not found' }
    if (data.voided_at != null) return { ok: false, error: 'This invoice is voided and cannot be edited.' }
    const need = data.status === 'draft' ? 'invoices.edit' : 'invoices.manage'
    if (!this.permissions.has(ctx, need)) return { ok: false, error: 'You do not have permission to do this.' }
    return { ok: true }
  }

  private async invoiceLabel(id: string): Promise<string | null> {
    const { data } = await this.supabase.admin.from('invoices').select('invoice_number').eq('id', id).single()
    return (data?.invoice_number as string | null) ?? null
  }

  // Mirrors createInvoiceAction(): validate + money cross-check → snapshot (if
  // issued) → create_invoice_with_items RPC → activity → { ok, id }.
  @Post()
  @RequirePermission('invoices.create')
  async create(@Body() body: { p_invoice: Record<string, unknown> & { status: 'draft' | 'sent' }; p_items: unknown[] }, @Auth() ctx: AuthContext): Promise<Res> {
    const parsed = createInvoiceInputSchema.safeParse(body)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

    const moneyErr = invoiceMoneyError(body.p_invoice as never, body.p_items as never)
    if (moneyErr) return { ok: false, error: moneyErr }

    const invoicePayload = {
      ...body.p_invoice,
      created_by: ctx.userId,
      ...(body.p_invoice.status === 'draft' ? {} : await this.billing.invoiceSnapshot()),
    }
    const { data, error } = await this.supabase.admin.rpc('create_invoice_with_items', {
      p_invoice: invoicePayload as never,
      p_items: body.p_items as never,
    })
    if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create invoice' }
    const newId = data as string
    await this.activity.logInvoiceActivity({
      invoiceId: newId, actorId: ctx.userId, actorName: ctx.actorName,
      action: 'invoice.created', entityLabel: await this.invoiceLabel(newId),
      metadata: { status: body.p_invoice.status },
    })
    return { ok: true, id: newId }
  }

  // Mirrors recordPaymentAction(): record_payment RPC → activity.
  @Post(':id/payment')
  @RequirePermission('invoices.manage')
  async recordPayment(
    @Param('id') id: string,
    @Body() input: { amount: number; payment_date?: string; reference?: string; notes?: string },
    @Auth() ctx: AuthContext,
  ): Promise<Res> {
    if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid invoice id' }
    const parsed = recordPaymentInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

    const { error } = await this.supabase.admin.rpc('record_payment', {
      p_invoice_id: id,
      p_amount: input.amount,
      p_created_by: ctx.userId,
      p_payment_date: input.payment_date,
      p_reference: input.reference,
      p_notes: input.notes,
    })
    if (error) return { ok: false, error: error.message }
    await this.activity.logInvoiceActivity({
      invoiceId: id, actorId: ctx.userId, actorName: ctx.actorName,
      action: 'payment.recorded', entityLabel: await this.invoiceLabel(id),
      metadata: { amount: input.amount, payment_date: input.payment_date ?? null, reference_number: input.reference ?? null },
    })
    return { ok: true }
  }

  // Mirrors markSentAction(): content-edit gate → status=sent + snapshot → activity.
  @Post(':id/mark-sent')
  async markSent(@Param('id') id: string, @Auth() ctx: AuthContext): Promise<Res> {
    const gate = await this.gateContentEdit(id, ctx)
    if (!gate.ok) return gate
    if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid invoice id' }

    const { error } = await this.supabase.admin
      .from('invoices')
      .update({ status: 'sent', ...(await this.billing.invoiceSnapshot()) })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    await this.activity.logInvoiceActivity({
      invoiceId: id, actorId: ctx.userId, actorName: ctx.actorName,
      action: 'invoice.issued', entityLabel: await this.invoiceLabel(id),
    })
    return { ok: true }
  }

  // Mirrors updateCaseDetailsAction(): patient/doctor + diffed activity.
  @Patch(':id/case')
  async updateCase(@Param('id') id: string, @Body() input: { patient: string | null; doctor: string | null }, @Auth() ctx: AuthContext): Promise<Res> {
    const gate = await this.gateContentEdit(id, ctx)
    if (!gate.ok) return gate
    if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid invoice id' }
    if (!caseDetailsSchema.safeParse(input).success) return { ok: false, error: 'Invalid case details' }

    const { data: before } = await this.supabase.admin.from('invoices').select('patient, doctor, invoice_number').eq('id', id).single()
    const { error } = await this.supabase.admin.from('invoices').update({ patient: input.patient, doctor: input.doctor }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    const changes = diffFields((before ?? {}) as Record<string, unknown>, input as unknown as Record<string, unknown>, { patient: 'Patient', doctor: 'Doctor' })
    if (changes.length > 0) {
      await this.activity.logInvoiceActivity({
        invoiceId: id, actorId: ctx.userId, actorName: ctx.actorName,
        action: 'invoice.case_changed', entityLabel: (before?.invoice_number as string | null) ?? null, changes,
      })
    }
    return { ok: true }
  }

  // Mirrors updateServiceStatusAction().
  @Patch(':id/service-status')
  async updateServiceStatus(@Param('id') id: string, @Body() input: { serviceStatusId: string | null }, @Auth() ctx: AuthContext): Promise<Res> {
    const gate = await this.gateContentEdit(id, ctx)
    if (!gate.ok) return gate
    if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid invoice id' }
    if (!serviceStatusInputSchema.safeParse({ serviceStatusId: input.serviceStatusId }).success) return { ok: false, error: 'Invalid service status' }

    const { data: before } = await this.supabase.admin.from('invoices').select('service_status_id, invoice_number').eq('id', id).single()
    const { error } = await this.supabase.admin.from('invoices').update({ service_status_id: input.serviceStatusId }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    if ((before?.service_status_id ?? null) !== (input.serviceStatusId ?? null)) {
      await this.activity.logInvoiceActivity({
        invoiceId: id, actorId: ctx.userId, actorName: ctx.actorName,
        action: 'invoice.service_status_changed', entityLabel: (before?.invoice_number as string | null) ?? null,
        changes: [{ field: 'service_status_id', label: 'Service status', from: before?.service_status_id ?? null, to: input.serviceStatusId ?? null }],
      })
    }
    return { ok: true }
  }

  // Mirrors saveRecipientAction(): recipient fields (+ optional push to clinic).
  @Patch(':id/recipient')
  async saveRecipient(
    @Param('id') id: string,
    @Body() body: { fields: Record<string, string | null>; alsoSaveToCustomer?: boolean; customerId?: string },
    @Auth() ctx: AuthContext,
  ): Promise<Res> {
    const gate = await this.gateContentEdit(id, ctx)
    if (!gate.ok) return gate
    const { fields, alsoSaveToCustomer, customerId } = body
    if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid invoice id' }
    if (!recipientFieldsSchema.safeParse(fields).success) return { ok: false, error: 'Invalid recipient fields' }
    if (customerId && !idSchema.safeParse(customerId).success) return { ok: false, error: 'Invalid customer id' }

    const recipientCols = 'bill_to_name, bill_to_contact, bill_to_phone, billing_address, ship_to_name, ship_to_contact, delivery_address, invoice_number'
    const { data: before } = await this.supabase.admin.from('invoices').select(recipientCols).eq('id', id).single()
    const { error } = await this.supabase.admin.from('invoices').update(fields).eq('id', id)
    if (error) return { ok: false, error: error.message }

    if (alsoSaveToCustomer && customerId) {
      const customerUpdate: Record<string, string | null> = {
        contact_person: fields.bill_to_contact,
        phone: fields.bill_to_phone,
        billing_address: fields.billing_address,
        delivery_address: fields.delivery_address,
      }
      if (fields.bill_to_name) customerUpdate.clinic_name = fields.bill_to_name
      const { error: custErr } = await this.supabase.admin.from('customers').update(customerUpdate).eq('id', customerId)
      if (custErr) return { ok: false, error: custErr.message }
    }

    const changes = diffFields((before ?? {}) as Record<string, unknown>, fields as Record<string, unknown>, RECIPIENT_FIELD_LABELS)
    if (changes.length > 0) {
      await this.activity.logInvoiceActivity({
        invoiceId: id, actorId: ctx.userId, actorName: ctx.actorName,
        action: 'invoice.recipient_changed',
        entityLabel: ((before as { invoice_number?: string } | null)?.invoice_number as string | null) ?? null,
        changes,
      })
    }
    return { ok: true }
  }

  // Mirrors updateInvoiceAction(): content-edit gate → money check →
  // update_invoice_with_items RPC → diffed activity. Declared last so its bare
  // `:id` doesn't shadow the two-segment PATCH routes above.
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { p_invoice: Record<string, unknown>; p_items: Array<{ id?: string | null }> }, @Auth() ctx: AuthContext): Promise<Res> {
    const gate = await this.gateContentEdit(id, ctx)
    if (!gate.ok) return gate
    if (!idSchema.safeParse(id).success) return { ok: false, error: 'Invalid invoice id' }
    const parsed = updateInvoiceInputSchema.safeParse(body)
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

    const moneyErr = invoiceMoneyError(body.p_invoice as never, body.p_items as never)
    if (moneyErr) return { ok: false, error: moneyErr }

    const { data: beforeInv } = await this.supabase.admin
      .from('invoices')
      .select('invoice_date, due_date, notes, patient, doctor, service_status_id, subtotal, total, invoice_number')
      .eq('id', id).single()
    const { data: beforeItems } = await this.supabase.admin.from('invoice_items').select('id').eq('invoice_id', id)
    const beforeCount = beforeItems?.length ?? 0

    const { error } = await this.supabase.admin.rpc('update_invoice_with_items', {
      p_invoice_id: id,
      p_invoice: body.p_invoice as never,
      p_items: body.p_items as never,
    })
    if (error) return { ok: false, error: error.message }

    const headerChanges = diffFields((beforeInv ?? {}) as Record<string, unknown>, body.p_invoice as Record<string, unknown>, INVOICE_FIELD_LABELS)
    const keptIds = new Set(body.p_items.filter((i) => i.id).map((i) => i.id))
    const removed = (beforeItems ?? []).filter((b) => !keptIds.has(b.id)).length
    const added = body.p_items.filter((i) => !i.id).length
    const itemsChanged = added > 0 || removed > 0
    if (headerChanges.length > 0 || itemsChanged) {
      await this.activity.logInvoiceActivity({
        invoiceId: id, actorId: ctx.userId, actorName: ctx.actorName,
        action: 'invoice.edited', entityLabel: (beforeInv?.invoice_number as string | null) ?? null,
        changes: headerChanges.length > 0 ? headerChanges : null,
        metadata: itemsChanged ? { items: { before_count: beforeCount, after_count: body.p_items.length, added, removed } } : null,
      })
    }
    return { ok: true }
  }
}

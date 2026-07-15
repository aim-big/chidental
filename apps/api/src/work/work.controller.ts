import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { idSchema, workStatusInputSchema, workNoteInputSchema, type WorkStatus } from '@chidental/shared'
import { SupabaseService } from '../supabase/supabase.service'
import { RequirePermission } from '../auth/require-permission.decorator'
import { Auth, AccessToken } from '../auth/auth-context.decorator'
import type { AuthContext } from '../auth/permissions.service'
import { ActivityLogService } from '../audit/activity-log.service'

// Read endpoint for the work-queue module (strangler migration, module 3).
// Mirrors apps/web `src/data/work.ts` getWorkQueue() verbatim: same embedded
// select, same ordering, same client-side exclusion of items whose parent
// invoice is voided/deleted. The invoice_items / work_stages /
// work_status_configs / invoices / customers read policies are all
// `using (true)`, so the service-role client returns the same rows the RLS
// session client does. Any authenticated user may read the queue — the global
// guard's valid-session check is the gate.
@Controller('work')
export class WorkController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly activity: ActivityLogService,
  ) {}

  // Mirrors getWorkQueue(): items (voided/deleted parents excluded) + stages +
  // status configs. Same { rows, stages, statusConfigs } shape.
  @Get('queue')
  async queue() {
    const [itemsRes, stagesRes, statusConfigsRes] = await Promise.all([
      this.supabase.admin
        .from('invoice_items')
        .select(
          'id, description, work_status, stage_id, resume_status, work_status_updated_at, invoices(id, invoice_number, status, voided_at, deleted_at, patient, due_date, customers(clinic_name))',
        )
        .order('work_status_updated_at', { ascending: false })
        .order('id', { ascending: true }),
      this.supabase.admin.from('work_stages').select('*').order('sort_order').order('label'),
      this.supabase.admin.from('work_status_configs').select('*').order('sort_order'),
    ])

    if (itemsRes.error) throw new Error(itemsRes.error.message)

    const rows = (
      (itemsRes.data ?? []) as unknown as Array<{
        invoices: { voided_at: string | null; deleted_at: string | null } | null
      }>
    ).filter((r) => r.invoices != null && r.invoices.voided_at == null && r.invoices.deleted_at == null)

    return {
      rows,
      stages: stagesRes.data ?? [],
      statusConfigs: statusConfigsRes.data ?? [],
    }
  }

  // --- Writes (strangler module 8: work-actions) ----------------------------
  // Both mirror apps/web `src/data/invoice-actions.ts` and gate on invoices.view
  // (same key the UI uses — the status dropdown/note render for any non-void
  // invoice). Return { ok, invoiceId } so the web seam can revalidateInvoice.
  //
  // DELIBERATE: these mutations gate on invoices.VIEW, not an edit/manage key.
  // Updating work progress is the lab's daily operational task, done by whoever
  // can see the invoice — so a role holding only `invoices.view` CAN change work
  // status and add work notes. "View invoices" is therefore NOT a read-only role
  // for the work board. See docs/CONVENTIONS.md → Permissions. If you ever need a
  // truly read-only role, add a dedicated `work.edit` key rather than re-gating
  // here (which would silently strip work access from existing view-only roles).

  // Mirrors updateWorkStatusAction(). Uses the USER-scoped client so the
  // invoice_item_status_history trigger records the real actor via auth.uid();
  // the admin client (no session) would log a null actor. Computes the on_hold
  // round-trip inline (production `hold().resumeFrom` == the current status).
  @Post('items/:id/status')
  @RequirePermission('invoices.view')
  async updateStatus(
    @Param('id') itemId: string,
    @Body() body: unknown,
    @AccessToken() token: string,
  ) {
    if (!idSchema.safeParse(itemId).success) return { ok: false, error: 'Invalid item id' }
    const parsed = workStatusInputSchema.safeParse(body)
    if (!parsed.success) return { ok: false, error: 'Invalid work status' }
    const input = parsed.data

    const db = this.supabase.forUser(token)

    const { data: current, error: readErr } = await db
      .from('invoice_items')
      .select('work_status, resume_status')
      .eq('id', itemId)
      .single()
    if (readErr || !current) return { ok: false, error: readErr?.message ?? 'Work item not found' }

    // entering on_hold from a non-hold status → remember it; re-selecting on_hold
    // while already on_hold → preserve; any non-hold target → forget.
    const resume_status: WorkStatus | null =
      input.work_status === 'on_hold'
        ? current.work_status === 'on_hold'
          ? (current.resume_status as WorkStatus | null)
          : (current.work_status as WorkStatus)
        : null

    const { data, error } = await db
      .from('invoice_items')
      .update({ work_status: input.work_status, stage_id: input.stage_id, resume_status })
      .eq('id', itemId)
      .select('invoice_id')
      .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, invoiceId: (data?.invoice_id as string | null) ?? null }
  }

  // Mirrors updateWorkNoteAction(). The note has no auth.uid() dependency (its
  // audit is the explicit activity row below), so the admin client is fine.
  @Post('items/:id/note')
  @RequirePermission('invoices.view')
  async updateNote(@Param('id') itemId: string, @Body() body: unknown, @Auth() auth: AuthContext) {
    if (!idSchema.safeParse(itemId).success) return { ok: false, error: 'Invalid item id' }
    const parsed = workNoteInputSchema.safeParse(body)
    if (!parsed.success) return { ok: false, error: 'Invalid note' }

    const trimmed = parsed.data.workNote?.trim()
    const value = trimmed ? trimmed : null

    const { data, error } = await this.supabase.admin
      .from('invoice_items')
      .update({ work_note: value })
      .eq('id', itemId)
      .select('invoice_id, description')
      .single()
    if (error) return { ok: false, error: error.message }

    await this.activity.logInvoiceActivity({
      invoiceId: (data?.invoice_id as string | null) ?? null,
      actorId: auth.userId,
      actorName: auth.actorName,
      action: 'invoice.work_note_changed',
      entityLabel: null,
      metadata: { item: (data?.description as string | null) ?? null, note: value },
    })
    return { ok: true, invoiceId: (data?.invoice_id as string | null) ?? null }
  }
}

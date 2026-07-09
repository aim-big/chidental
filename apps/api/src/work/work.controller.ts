import { Controller, Get } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'

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
  constructor(private readonly supabase: SupabaseService) {}

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
}

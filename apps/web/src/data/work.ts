// Server-side READ query for the work queue.
//
// The work module is served entirely by the NestJS API. `getWorkQueue` is a
// thin, typed proxy over `GET /work/queue`; the signature is unchanged so the
// page is untouched.
//
// Writes live in `./invoice-actions.ts` (`updateWorkStatusAction`).

import { apiGet } from '@/lib/api/client'
import type { InvoiceItem, WorkStage, WorkStatus, WorkStatusConfig } from '@chidental/shared'

// One work-queue row: the invoice item fields the page reads, plus the embedded
// invoice + customer shape the select returns.
export type WorkQueueRow = Pick<
  InvoiceItem,
  'id' | 'description' | 'work_status' | 'stage_id' | 'resume_status' | 'work_status_updated_at'
> & {
  work_status: WorkStatus
  resume_status: WorkStatus | null
  invoices: {
    id: string
    invoice_number: string
    status: string
    voided_at: string | null
    deleted_at: string | null
    patient: string | null
    due_date: string
    customers: { clinic_name: string } | null
  } | null
}

// The work queue: items (voided/deleted parents excluded) + the work stages +
// the status configs used to render/order the per-item status dropdowns.
export async function getWorkQueue(): Promise<{ rows: WorkQueueRow[]; stages: WorkStage[]; statusConfigs: WorkStatusConfig[] }> {
  return apiGet<{ rows: WorkQueueRow[]; stages: WorkStage[]; statusConfigs: WorkStatusConfig[] }>('/work/queue')
}

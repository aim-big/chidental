import type { Invoice } from '@/lib/database.types'
import { isVoided } from '@/lib/invoice-status'

/**
 * Whether an invoice's content (header fields, line items, recipient,
 * patient/doctor) may be edited.
 *
 * Rules:
 * - Voided (soft-deleted) is terminal — locked for everyone.
 * - `draft` is editable by anyone (staff or admin).
 * - Once sent (`sent`/`partial`/`paid`/`overdue`) only an admin may edit.
 *
 * UI gating only for now; not a security boundary. A future employee module
 * will move roles into the database and add RLS enforcement.
 */
export function canEditInvoice(inv: Pick<Invoice, 'status' | 'voided_at'>, role: string): boolean {
  if (isVoided(inv)) return false
  return inv.status === 'draft' || role === 'admin'
}

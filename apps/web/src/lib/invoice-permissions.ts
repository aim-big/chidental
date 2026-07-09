import type { Invoice, Permission } from '@chidental/shared'
import { isVoided } from '@chidental/shared'

/**
 * Whether an invoice's content (header fields, line items, recipient,
 * patient/doctor) may be edited.
 *
 * Rules:
 * - Voided (soft-deleted) is terminal — locked for everyone.
 * - `draft` requires the `invoices.edit` permission.
 * - Once sent (`sent`/`partial`/`paid`/`overdue`) requires `invoices.manage`.
 *
 * `has` is the caller's capability predicate (from AuthContext on the client).
 * UI gating only; the server action is the real boundary.
 */
export function canEditInvoice(
  inv: Pick<Invoice, 'status' | 'voided_at'>,
  has: (permission: Permission) => boolean,
): boolean {
  if (isVoided(inv)) return false
  return inv.status === 'draft' ? has('invoices.edit') : has('invoices.manage')
}

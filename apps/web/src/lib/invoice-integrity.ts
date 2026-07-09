import { isVoided } from '@chidental/shared'

// Data-integrity classifier for a single invoice. Mirrors the SQL "health check"
// used by the Super Admin Data Health panel and by the DB guard's intent: an
// invoice's stored `status` must stay consistent with the payment rows recorded
// against it, and its money fields (total/subtotal/line items) must add up.
//
// Returns the single most salient issue (or null when the invoice is healthy).
// The money model is total = subtotal = sum(line amounts) — no tax/discount
// (docs/CONVENTIONS.md §3, enforced at write time by invoiceMoneyError).

export type IntegrityCode =
  | 'paid_amount_mismatch'
  | 'partial_no_payment'
  | 'partial_fully_covered'
  | 'outstanding_with_payments'
  | 'draft_with_payments'
  | 'voided_but_active_payment'
  | 'amount_paid_desync'
  | 'total_ne_subtotal'
  | 'subtotal_ne_lines'

export interface IntegrityIssue {
  code: IntegrityCode
  message: string
}

export interface IntegrityInput {
  status: string
  total: number
  subtotal: number
  /** Denormalized trigger-maintained sum; omit (undefined/null) to skip the drift check. */
  amount_paid?: number | null
  voided_at: string | null
  deleted_at?: string | null
  /** Live sum of the invoice's payment rows. */
  paymentSum: number
  /** Number of payment rows on the invoice. */
  paymentCount: number
  /** Sum of the invoice's line-item amounts. */
  lineSum: number
}

// Compare money in integer cents so numeric(12,2) round-trips and float noise
// (e.g. 160.001) don't produce false mismatches.
const cents = (n: number): number => Math.round(n * 100)
const rm = (n: number): string => `RM ${n.toFixed(2)}`

export function invoiceIntegrityIssue(inv: IntegrityInput): IntegrityIssue | null {
  const live = !isVoided(inv) && inv.deleted_at == null

  if (live) {
    if (inv.status === 'paid' && cents(inv.paymentSum) !== cents(inv.total)) {
      return { code: 'paid_amount_mismatch', message: `Marked Paid but recorded ${rm(inv.paymentSum)} of ${rm(inv.total)}` }
    }
    if (inv.status === 'partial' && inv.paymentSum === 0) {
      return { code: 'partial_no_payment', message: 'Marked Partial but no payment recorded' }
    }
    if (inv.status === 'partial' && inv.total > 0 && cents(inv.paymentSum) >= cents(inv.total)) {
      return { code: 'partial_fully_covered', message: `Marked Partial but payments (${rm(inv.paymentSum)}) already cover the total — should be Paid` }
    }
    if ((inv.status === 'sent' || inv.status === 'overdue') && inv.paymentSum > 0) {
      return { code: 'outstanding_with_payments', message: `Marked ${inv.status} but has ${rm(inv.paymentSum)} in payments — should be Partial or Paid` }
    }
    if (inv.status === 'draft' && inv.paymentCount > 0) {
      return { code: 'draft_with_payments', message: 'Draft invoice has payment rows' }
    }
  } else if (inv.status === 'paid' || inv.status === 'partial' || inv.paymentCount > 0) {
    return { code: 'voided_but_active_payment', message: 'Voided/deleted invoice is still marked paid or has payment rows' }
  }

  if (inv.amount_paid != null && cents(inv.amount_paid) !== cents(inv.paymentSum)) {
    return { code: 'amount_paid_desync', message: `Stored paid-amount (${rm(inv.amount_paid)}) differs from the sum of payment rows (${rm(inv.paymentSum)})` }
  }
  if (cents(inv.total) !== cents(inv.subtotal)) {
    return { code: 'total_ne_subtotal', message: `Total (${rm(inv.total)}) does not equal subtotal (${rm(inv.subtotal)})` }
  }
  if (cents(inv.subtotal) !== cents(inv.lineSum)) {
    return { code: 'subtotal_ne_lines', message: `Subtotal (${rm(inv.subtotal)}) does not match line items (${rm(inv.lineSum)})` }
  }

  return null
}

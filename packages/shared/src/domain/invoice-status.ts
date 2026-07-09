// Invoice status + money predicates — the single source of truth, shared by
// apps/web and apps/api. Consolidated here from what used to live in both
// `apps/web/src/lib/invoice-status.ts` and this package's `domain/billing.ts`
// (which now keeps only the manual-transition rules). Backend-safe: no
// React/UI, only date-fns + the Invoice row type.
import { differenceInCalendarDays } from 'date-fns'
import type { Invoice } from '../database.types'

type VoidFields = Pick<Invoice, 'voided_at'>
type CountFields = Pick<Invoice, 'voided_at' | 'status'>
type DueFields = Pick<Invoice, 'voided_at' | 'status' | 'due_date'>

export const OUTSTANDING_STATUSES = ['sent', 'partial', 'overdue'] as const

/** An invoice is voided (soft-deleted/cancelled) when voided_at is set. */
export const isVoided = (inv: VoidFields): boolean => inv.voided_at != null

/** Counts toward recognized revenue: paid and not voided. */
export const countsAsRevenue = (inv: CountFields): boolean =>
  !isVoided(inv) && inv.status === 'paid'

/** Owed money: sent/partial/overdue and not voided. */
export const isOutstanding = (inv: CountFields): boolean =>
  !isVoided(inv) && (OUTSTANDING_STATUSES as readonly string[]).includes(inv.status)

type BalanceFields = CountFields & { total: number; amount_paid?: number | null }

/**
 * Money still owed on ONE invoice: total − amount_paid, floored at 0. Paid and
 * voided invoices owe nothing. `amount_paid` is the trigger-maintained sum of
 * the invoice's payment rows (see migration 20260702075027); when a narrow
 * query row omits it, the fallback is the full total — the pre-column
 * behavior. Every outstanding/aging aggregate must sum THIS, not `total`,
 * so partially-paid invoices aren't overstated.
 */
export const balanceDue = (inv: BalanceFields): number => {
  if (isVoided(inv) || inv.status === 'paid') return 0
  return Math.max(0, Number(inv.total) - Number(inv.amount_paid ?? 0))
}

/**
 * The status to write after recording a payment. `paidSum` is the total of all
 * recorded payment rows; `total` is the invoice total. A fully-covered invoice
 * becomes 'paid', otherwise 'partial'. An invoice already settled (status
 * 'paid') is never downgraded: logging a later payment must not flip it back to
 * partial.
 */
export const nextStatusAfterPayment = (
  current: string,
  paidSum: number,
  total: number,
): 'paid' | 'partial' =>
  current === 'paid' || paidSum >= total ? 'paid' : 'partial'

/**
 * Overdue is derived, not stored: an outstanding invoice whose due date has
 * passed. `today` is a local `yyyy-MM-dd` string (see `todayISODate`); string
 * comparison is valid for that fixed-width format.
 */
export const isOverdue = (inv: DueFields, today: string): boolean =>
  isOutstanding(inv) && inv.due_date != null && inv.due_date !== '' && inv.due_date < today

type SummaryFields = Pick<Invoice, 'voided_at' | 'status' | 'total'> & { amount_paid?: number | null }

/**
 * Customer billing rollup. `totalBilled` sums every non-voided invoice total;
 * `totalOutstanding` sums the remaining balance (total − amount_paid) on
 * outstanding (sent/partial/overdue, non-voided) invoices, so partial payments
 * net out.
 */
export const summarizeCustomerInvoices = (
  invoices: SummaryFields[],
): { totalBilled: number; totalOutstanding: number } => ({
  totalBilled: invoices.filter((i) => !isVoided(i)).reduce((s, i) => s + Number(i.total), 0),
  totalOutstanding: invoices.filter((i) => isOutstanding(i)).reduce((s, i) => s + balanceDue(i), 0),
})

type AgingFields = Pick<Invoice, 'voided_at' | 'status' | 'total' | 'due_date'> & { amount_paid?: number | null }

export interface ArAging {
  current: number // not yet past due
  d1_30: number
  d31_60: number
  d61_90: number
  d90plus: number
  total: number
}

/**
 * A/R aging of a clinic's OUTSTANDING invoices, bucketed by days past the due
 * date. Buckets each invoice's remaining BALANCE (total − amount_paid), the
 * same measure as `summarizeCustomerInvoices`, so the buckets sum to
 * `totalOutstanding`. `today` is a local `yyyy-MM-dd` string (see `todayISODate`).
 */
export const arAging = (invoices: AgingFields[], today: string): ArAging => {
  const out: ArAging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 }
  for (const inv of invoices) {
    if (!isOutstanding(inv)) continue
    const amt = balanceDue(inv)
    if (amt <= 0) continue
    out.total += amt
    if (inv.due_date == null || inv.due_date === '') {
      out.current += amt
      continue
    }
    const days = differenceInCalendarDays(new Date(today), new Date(inv.due_date))
    if (days <= 0) out.current += amt
    else if (days <= 30) out.d1_30 += amt
    else if (days <= 60) out.d31_60 += amt
    else if (days <= 90) out.d61_90 += amt
    else out.d90plus += amt
  }
  return out
}

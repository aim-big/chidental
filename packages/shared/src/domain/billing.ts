// Manual invoice status-transition rules. The status/money PREDICATES that used
// to live here (isVoided/isOutstanding/countsAsRevenue/isOverdue/
// nextStatusAfterPayment) now live in `./invoice-status` as the single source of
// truth; this file keeps only the allowed manual transitions.
export type BillingStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue'

// allowed MANUAL transitions (payment-driven changes go through nextStatusAfterPayment)
const TRANSITIONS: Record<BillingStatus, BillingStatus[]> = {
  draft: ['sent'],
  sent: ['partial', 'paid'],
  partial: ['paid'],
  paid: [],
  overdue: ['partial', 'paid'],
}
export const canTransition = (from: BillingStatus, to: BillingStatus) =>
  TRANSITIONS[from]?.includes(to) ?? false

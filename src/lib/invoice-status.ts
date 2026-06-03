import type { Invoice } from '@/lib/database.types'

type VoidFields = Pick<Invoice, 'voided_at'>
type CountFields = Pick<Invoice, 'voided_at' | 'status'>

const OUTSTANDING_STATUSES = ['sent', 'partial', 'overdue'] as const

/** An invoice is voided (soft-deleted/cancelled) when voided_at is set. */
export const isVoided = (inv: VoidFields): boolean => inv.voided_at != null

/** Counts toward recognized revenue: paid and not voided. */
export const countsAsRevenue = (inv: CountFields): boolean =>
  !isVoided(inv) && inv.status === 'paid'

/** Owed money: sent/partial/overdue and not voided. */
export const isOutstanding = (inv: CountFields): boolean =>
  !isVoided(inv) && (OUTSTANDING_STATUSES as readonly string[]).includes(inv.status)

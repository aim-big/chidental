// Invoice status + money predicates now live in @chidental/shared (single source
// of truth, consumed by apps/web and apps/api). This module stays as the app's
// import path — `@/lib/invoice-status` — re-exporting the shared kernel so the
// many call sites don't churn. Prefer importing straight from '@chidental/shared'
// in new code; this shim can retire in Phase 4.
export {
  OUTSTANDING_STATUSES,
  isVoided,
  countsAsRevenue,
  isOutstanding,
  balanceDue,
  nextStatusAfterPayment,
  isOverdue,
  summarizeCustomerInvoices,
  arAging,
  type ArAging,
} from '@chidental/shared'

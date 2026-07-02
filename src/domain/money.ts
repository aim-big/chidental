export const formatCurrency = (n: number) =>
  new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(n)

export const outstandingAmount = (total: number, paidSum: number) =>
  Math.max(0, Number((total - paidSum).toFixed(2)))

export const balancingPaymentAmount = (total: number, paidSum: number) =>
  outstandingAmount(total, paidSum)

const cents = (n: number) => Math.round(n * 100)

/**
 * Cross-check the money fields a client sends for an invoice write. The money
 * model is total = subtotal = sum of line amounts (no discount/tax —
 * docs/CONVENTIONS.md §3), but the DB stores whatever it is sent, so the server
 * must refuse an inconsistent payload. Compares in integer cents to tolerate
 * float noise. Returns a user-facing error, or null when consistent.
 */
export const invoiceMoneyError = (
  invoice: { subtotal: number; total: number },
  items: { amount: number }[],
): string | null => {
  if (cents(invoice.subtotal) !== cents(invoice.total))
    return 'Invoice total must equal the subtotal.'
  const lineSum = items.reduce((s, i) => s + cents(i.amount), 0)
  if (lineSum !== cents(invoice.total))
    return 'Line item amounts do not add up to the invoice total.'
  return null
}

export const formatCurrency = (n: number) =>
  new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(n)

export const outstandingAmount = (total: number, paidSum: number) =>
  Math.max(0, Number((total - paidSum).toFixed(2)))

export const balancingPaymentAmount = (total: number, paidSum: number) =>
  outstandingAmount(total, paidSum)

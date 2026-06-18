import { describe, it, expect } from 'vitest'
import { outstandingAmount, balancingPaymentAmount, formatCurrency } from './money'

describe('money', () => {
  it('outstanding clamps at 0', () => {
    expect(outstandingAmount(100, 40)).toBe(60)
    expect(outstandingAmount(100, 120)).toBe(0)
  })
  it('balancing payment equals outstanding', () =>
    expect(balancingPaymentAmount(100, 40)).toBe(60))
  it('formats MYR', () => expect(formatCurrency(1234.5)).toContain('1,234.50'))
})

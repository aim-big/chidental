import { describe, it, expect } from 'vitest'
import { outstandingAmount, balancingPaymentAmount, formatCurrency, invoiceMoneyError } from './money'

describe('money', () => {
  it('outstanding clamps at 0', () => {
    expect(outstandingAmount(100, 40)).toBe(60)
    expect(outstandingAmount(100, 120)).toBe(0)
  })
  it('balancing payment equals outstanding', () =>
    expect(balancingPaymentAmount(100, 40)).toBe(60))
  it('formats MYR', () => expect(formatCurrency(1234.5)).toContain('1,234.50'))
})

describe('invoiceMoneyError', () => {
  it('accepts a consistent payload', () => {
    expect(invoiceMoneyError({ subtotal: 150.33, total: 150.33 }, [{ amount: 100 }, { amount: 50.33 }])).toBeNull()
  })
  it('rejects subtotal ≠ total', () => {
    expect(invoiceMoneyError({ subtotal: 100, total: 150 }, [{ amount: 150 }])).toMatch(/subtotal/i)
  })
  it('rejects line amounts that do not sum to the total', () => {
    expect(invoiceMoneyError({ subtotal: 149, total: 149 }, [{ amount: 100 }, { amount: 50.33 }])).toMatch(/add up/i)
  })
  it('tolerates sub-cent float noise', () => {
    expect(invoiceMoneyError({ subtotal: 0.3, total: 0.3 }, [{ amount: 0.1 }, { amount: 0.2 }])).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { invoiceIntegrityIssue, type IntegrityInput } from './invoice-integrity'

// A healthy invoice baseline; each test overrides only the fields it exercises.
const base: IntegrityInput = {
  status: 'sent',
  total: 100,
  subtotal: 100,
  amount_paid: 0,
  voided_at: null,
  deleted_at: null,
  paymentSum: 0,
  paymentCount: 0,
  lineSum: 100,
}
const inv = (o: Partial<IntegrityInput>): IntegrityInput => ({ ...base, ...o })

describe('invoiceIntegrityIssue — healthy invoices return null', () => {
  it('paid invoice whose payments exactly cover the total', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'paid', total: 100, paymentSum: 100, amount_paid: 100, paymentCount: 1 }))).toBeNull()
  })
  it('sent invoice with no payments', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'sent' }))).toBeNull()
  })
  it('partially-paid invoice (some, but not all, recorded)', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'partial', total: 100, paymentSum: 40, amount_paid: 40, paymentCount: 1 }))).toBeNull()
  })
  it('draft invoice with no payments', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'draft' }))).toBeNull()
  })
  it('normally voided invoice (sent, no payments)', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'sent', voided_at: '2026-06-01T00:00:00Z' }))).toBeNull()
  })
  it('tolerates sub-cent float noise between payments and total', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'paid', total: 160, subtotal: 160, lineSum: 160, paymentSum: 160.001, amount_paid: 160.001, paymentCount: 1 }))).toBeNull()
  })
})

describe('invoiceIntegrityIssue — status vs recorded payments', () => {
  it('flags PAID when recorded payments fall short of the total (the INV-0016 case)', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'paid', total: 160, paymentSum: 0, amount_paid: 0 }))?.code).toBe('paid_amount_mismatch')
  })
  it('flags PAID when recorded payments exceed the total', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'paid', total: 100, paymentSum: 120, amount_paid: 120, paymentCount: 1 }))?.code).toBe('paid_amount_mismatch')
  })
  it('flags PARTIAL with no payment recorded', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'partial', paymentSum: 0 }))?.code).toBe('partial_no_payment')
  })
  it('flags PARTIAL that is already fully covered (should be paid)', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'partial', total: 100, paymentSum: 100, amount_paid: 100, paymentCount: 1 }))?.code).toBe('partial_fully_covered')
  })
  it('flags SENT that has payments', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'sent', paymentSum: 50, amount_paid: 50, paymentCount: 1 }))?.code).toBe('outstanding_with_payments')
  })
  it('flags OVERDUE that has payments', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'overdue', paymentSum: 50, amount_paid: 50, paymentCount: 1 }))?.code).toBe('outstanding_with_payments')
  })
  it('flags DRAFT that has payment rows', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'draft', paymentSum: 50, amount_paid: 50, paymentCount: 1 }))?.code).toBe('draft_with_payments')
  })
})

describe('invoiceIntegrityIssue — voided/deleted invoices', () => {
  it('flags a voided invoice that is still marked paid', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'paid', voided_at: '2026-06-01T00:00:00Z', paymentSum: 100, amount_paid: 100, paymentCount: 1 }))?.code).toBe('voided_but_active_payment')
  })
  it('flags a deleted invoice that still has payment rows', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'sent', deleted_at: '2026-06-01T00:00:00Z', paymentSum: 50, amount_paid: 50, paymentCount: 1 }))?.code).toBe('voided_but_active_payment')
  })
})

describe('invoiceIntegrityIssue — money & denormalized-column consistency', () => {
  it('flags amount_paid drift from the true sum of payment rows', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'partial', total: 100, paymentSum: 40, amount_paid: 30, paymentCount: 1 }))?.code).toBe('amount_paid_desync')
  })
  it('flags total != subtotal', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'sent', total: 100, subtotal: 90, lineSum: 90 }))?.code).toBe('total_ne_subtotal')
  })
  it('flags subtotal != sum of line items', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'sent', total: 100, subtotal: 100, lineSum: 90 }))?.code).toBe('subtotal_ne_lines')
  })
  it('skips the amount_paid drift check when the column is not provided', () => {
    expect(invoiceIntegrityIssue(inv({ status: 'partial', total: 100, paymentSum: 40, amount_paid: null, paymentCount: 1 }))).toBeNull()
  })
})

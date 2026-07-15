import { describe, it, expect } from 'vitest'
import { paymentInputSchema, invoiceInputSchema, customerInputSchema, productInputSchema, normalizeUnit } from './schemas'
import {
  idSchema,
  invoiceItemPayloadSchema,
  createInvoiceInputSchema,
  recordPaymentInputSchema,
  workStatusInputSchema,
  billingSettingsInputSchema,
  dateRangeQuerySchema,
} from './schemas'

const product = (over: Record<string, unknown> = {}) => ({
  name: 'Crown', description: null, unit_price: 100, unit: 'per unit',
  min_unit_price: null, max_unit_price: null, ...over,
})
const customer = (over: Record<string, unknown> = {}) => ({
  clinic_name: 'Klinik Gigi', contact_person: 'Dr Lee', phone: '0123456789',
  email: 'clinic@example.com', billing_address: '1 Main St', delivery_address: '1 Main St', ...over,
})
describe('schemas', () => {
  it('rejects non-positive payment', () =>
    expect(paymentInputSchema.safeParse({ amount: 0 }).success).toBe(false))
  it('requires at least one line item', () =>
    expect(invoiceInputSchema.safeParse({ customer_id: 'x', due_date: '2026-01-01', items: [] }).success).toBe(false))

  it('requires a clinic name on a customer', () =>
    expect(customerInputSchema.safeParse(customer({ clinic_name: '' })).success).toBe(false))
  it('accepts a fully-populated customer', () =>
    expect(customerInputSchema.safeParse(customer()).success).toBe(true))
  it('requires contact details (contact person, phone, addresses)', () => {
    expect(customerInputSchema.safeParse(customer({ contact_person: '' })).success).toBe(false)
    expect(customerInputSchema.safeParse(customer({ phone: '' })).success).toBe(false)
    expect(customerInputSchema.safeParse(customer({ billing_address: '' })).success).toBe(false)
    expect(customerInputSchema.safeParse(customer({ delivery_address: '' })).success).toBe(false)
  })
  it('requires a valid email and rejects empty or malformed', () => {
    expect(customerInputSchema.safeParse(customer({ email: '' })).success).toBe(false)
    expect(customerInputSchema.safeParse(customer({ email: 'not-an-email' })).success).toBe(false)
  })

  it('accepts a single-price product', () =>
    expect(productInputSchema.safeParse(product()).success).toBe(true))
  it('accepts a valid price band (min <= max)', () =>
    expect(productInputSchema.safeParse(product({ min_unit_price: 50, max_unit_price: 150 })).success).toBe(true))
  it('rejects an inverted price band (min > max)', () =>
    expect(productInputSchema.safeParse(product({ min_unit_price: 150, max_unit_price: 50 })).success).toBe(false))
  it('requires a product name and unit', () => {
    expect(productInputSchema.safeParse(product({ name: '' })).success).toBe(false)
    expect(productInputSchema.safeParse(product({ unit: '' })).success).toBe(false)
  })

  it('normalizeUnit strips a leading "per " and lowercases', () => {
    expect(normalizeUnit('per unit')).toBe('unit')
    expect(normalizeUnit('Per Tooth')).toBe('tooth')
    expect(normalizeUnit('  per   arch ')).toBe('arch')
    expect(normalizeUnit('set')).toBe('set')
    expect(normalizeUnit('PER SET')).toBe('set')
  })
  it('normalizeUnit returns empty for blank or bare "per " input', () => {
    expect(normalizeUnit('   ')).toBe('')
    expect(normalizeUnit('per ')).toBe('')
  })
  it('normalizeUnit does not strip "per" when not followed by whitespace', () => {
    expect(normalizeUnit('persistent')).toBe('persistent')
    expect(normalizeUnit('perfect')).toBe('perfect')
  })
  it('productInputSchema normalizes the unit on parse', () => {
    const parsed = productInputSchema.safeParse(product({ unit: 'Per Tooth' }))
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.unit).toBe('tooth')
  })
  it('productInputSchema rejects a unit that normalizes to empty', () => {
    expect(productInputSchema.safeParse(product({ unit: 'per ' })).success).toBe(false)
    expect(productInputSchema.safeParse(product({ unit: '' })).success).toBe(false)
  })
})

describe('idSchema', () => {
  it('accepts a uuid', () => {
    expect(idSchema.safeParse('123e4567-e89b-12d3-a456-426614174000').success).toBe(true)
  })
  it('rejects a non-uuid string', () => {
    expect(idSchema.safeParse('not-an-id').success).toBe(false)
  })
})

describe('invoiceItemPayloadSchema', () => {
  const base = { product_id: null, description: 'Crown', quantity: 1, unit_price: 100, amount: 100 }
  it('accepts a valid line', () => {
    expect(invoiceItemPayloadSchema.safeParse(base).success).toBe(true)
  })
  it('rejects a non-positive quantity', () => {
    expect(invoiceItemPayloadSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false)
  })
  it('rejects an empty description', () => {
    expect(invoiceItemPayloadSchema.safeParse({ ...base, description: '' }).success).toBe(false)
  })
})

describe('createInvoiceInputSchema', () => {
  const invoice = {
    customer_id: '123e4567-e89b-12d3-a456-426614174000',
    invoice_date: '2026-07-09', due_date: '2026-08-08',
    notes: null, patient: null, doctor: null, service_status_id: null,
    bill_to_name: null, bill_to_contact: null, bill_to_phone: null, billing_address: null,
    ship_to_name: null, ship_to_contact: null, delivery_address: null,
    subtotal: 100, total: 100, status: 'draft' as const,
  }
  const items = [{ id: null, product_id: null, description: 'Crown', quantity: 1, unit_price: 100, amount: 100 }]
  it('accepts a valid create payload', () => {
    expect(createInvoiceInputSchema.safeParse({ p_invoice: invoice, p_items: items }).success).toBe(true)
  })
  it('rejects an empty items array', () => {
    expect(createInvoiceInputSchema.safeParse({ p_invoice: invoice, p_items: [] }).success).toBe(false)
  })
  it('rejects an unknown status', () => {
    expect(createInvoiceInputSchema.safeParse({ p_invoice: { ...invoice, status: 'paid' }, p_items: items }).success).toBe(false)
  })
})

describe('recordPaymentInputSchema', () => {
  it('accepts amount + optional reference', () => {
    expect(recordPaymentInputSchema.safeParse({ amount: 50, reference: 'TXN-1' }).success).toBe(true)
  })
  it('rejects a non-positive amount', () => {
    expect(recordPaymentInputSchema.safeParse({ amount: 0 }).success).toBe(false)
  })
})

describe('workStatusInputSchema', () => {
  it('accepts a known work_status', () => {
    expect(workStatusInputSchema.safeParse({ work_status: 'in_progress', stage_id: null }).success).toBe(true)
  })
  it('rejects an unknown work_status', () => {
    expect(workStatusInputSchema.safeParse({ work_status: 'shipped', stage_id: null }).success).toBe(false)
  })
})

describe('dateRangeQuerySchema', () => {
  it('accepts a valid YYYY-MM-DD range', () => {
    expect(dateRangeQuerySchema.safeParse({ from: '2026-07-01', to: '2026-07-31' }).success).toBe(true)
  })
  it('rejects a missing bound (the dashboard/reports 500 → 400 fix)', () => {
    expect(dateRangeQuerySchema.safeParse({}).success).toBe(false)
    expect(dateRangeQuerySchema.safeParse({ from: '2026-07-01' }).success).toBe(false)
  })
  it('rejects malformed or impossible dates', () => {
    expect(dateRangeQuerySchema.safeParse({ from: 'garbage', to: '2026-07-31' }).success).toBe(false)
    expect(dateRangeQuerySchema.safeParse({ from: '2026-13-45', to: '2026-07-31' }).success).toBe(false)
    expect(dateRangeQuerySchema.safeParse({ from: '2026-02-30', to: '2026-07-31' }).success).toBe(false)
  })
})

describe('billingSettingsInputSchema', () => {
  const base = { bankName: 'Maybank', accountName: 'Chi Dental', accountNumber: '123', paymentNote: 'x', invoiceNotes: ['a'], paymentTermsDays: 30 }
  it('accepts valid settings', () => {
    expect(billingSettingsInputSchema.safeParse(base).success).toBe(true)
  })
  it('rejects a blank bank name', () => {
    expect(billingSettingsInputSchema.safeParse({ ...base, bankName: '   ' }).success).toBe(false)
  })
  it('rejects payment terms below 1 day', () => {
    expect(billingSettingsInputSchema.safeParse({ ...base, paymentTermsDays: 0 }).success).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { actionLabel, INVOICE_FIELD_LABELS, RECIPIENT_FIELD_LABELS } from './action-labels'

describe('actionLabel', () => {
  it('maps known keys to friendly labels', () => {
    expect(actionLabel('invoice.issued')).toBe('Issued invoice')
    expect(actionLabel('payment.recorded')).toBe('Recorded payment')
    expect(actionLabel('invoice.voided')).toBe('Voided invoice')
    expect(actionLabel('work_status.changed')).toBe('Changed work status')
  })
  it('falls back to the raw key for unknown actions', () => {
    expect(actionLabel('something.weird')).toBe('something.weird')
  })
})

describe('field label maps', () => {
  it('uses Clinic terminology and covers diffed fields', () => {
    expect(INVOICE_FIELD_LABELS.due_date).toBe('Due date')
    expect(INVOICE_FIELD_LABELS.service_status_id).toBe('Service status')
    expect(RECIPIENT_FIELD_LABELS.bill_to_name).toBe('Bill-to name')
  })
})

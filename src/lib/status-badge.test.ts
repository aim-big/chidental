// src/lib/status-badge.test.ts
import { describe, it, expect } from 'vitest'
import { statusBadgeVariant, paymentStatusLabel } from './status-badge'

describe('statusBadgeVariant', () => {
  it('maps payment statuses', () => {
    expect(statusBadgeVariant('payment', 'draft')).toBe('secondary')
    expect(statusBadgeVariant('payment', 'sent')).toBe('info')
    expect(statusBadgeVariant('payment', 'partial')).toBe('warning')
    expect(statusBadgeVariant('payment', 'paid')).toBe('success')
    expect(statusBadgeVariant('payment', 'overdue')).toBe('destructive')
  })

  it('maps work statuses', () => {
    expect(statusBadgeVariant('work', 'received')).toBe('secondary')
    expect(statusBadgeVariant('work', 'in_progress')).toBe('info')
    expect(statusBadgeVariant('work', 'ready')).toBe('success')
    expect(statusBadgeVariant('work', 'delivered')).toBe('secondary')
    expect(statusBadgeVariant('work', 'on_hold')).toBe('warning')
  })

  it('falls back to secondary for unknown values', () => {
    expect(statusBadgeVariant('payment', 'mystery')).toBe('secondary')
    expect(statusBadgeVariant('work', '')).toBe('secondary')
  })
})

describe('paymentStatusLabel', () => {
  it('relabels the stored `sent` value as "Issued"', () => {
    expect(paymentStatusLabel('sent')).toBe('Issued')
  })

  it('capitalizes other statuses by default', () => {
    expect(paymentStatusLabel('draft')).toBe('Draft')
    expect(paymentStatusLabel('partial')).toBe('Partial')
    expect(paymentStatusLabel('paid')).toBe('Paid')
    expect(paymentStatusLabel('overdue')).toBe('Overdue')
  })
})

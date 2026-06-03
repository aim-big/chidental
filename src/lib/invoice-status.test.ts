import { describe, it, expect } from 'vitest'
import { isVoided, countsAsRevenue, isOutstanding } from './invoice-status'

const inv = (status: string, voided_at: string | null = null) =>
  ({ status, voided_at } as any)

describe('isVoided', () => {
  it('is false when voided_at is null', () => {
    expect(isVoided(inv('paid', null))).toBe(false)
  })
  it('is true when voided_at is set', () => {
    expect(isVoided(inv('paid', '2026-06-03T00:00:00Z'))).toBe(true)
  })
})

describe('countsAsRevenue', () => {
  it('counts a paid, non-voided invoice', () => {
    expect(countsAsRevenue(inv('paid'))).toBe(true)
  })
  it('does NOT count a paid invoice that is voided', () => {
    expect(countsAsRevenue(inv('paid', '2026-06-03T00:00:00Z'))).toBe(false)
  })
  it('does NOT count a non-paid invoice', () => {
    expect(countsAsRevenue(inv('sent'))).toBe(false)
  })
})

describe('isOutstanding', () => {
  it.each(['sent', 'partial', 'overdue'])('counts %s as outstanding', (s) => {
    expect(isOutstanding(inv(s))).toBe(true)
  })
  it('excludes a voided outstanding invoice', () => {
    expect(isOutstanding(inv('sent', '2026-06-03T00:00:00Z'))).toBe(false)
  })
  it('excludes draft and paid', () => {
    expect(isOutstanding(inv('draft'))).toBe(false)
    expect(isOutstanding(inv('paid'))).toBe(false)
  })
})

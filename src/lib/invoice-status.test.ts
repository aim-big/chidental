import { describe, it, expect } from 'vitest'
import { isVoided, countsAsRevenue, isOutstanding, isOverdue } from './invoice-status'

const inv = (status: string, voided_at: string | null = null) =>
  ({ status, voided_at } as any)

const dueInv = (status: string, due_date: string | null, voided_at: string | null = null) =>
  ({ status, due_date, voided_at } as any)

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

describe('isOverdue', () => {
  const TODAY = '2026-06-10'
  it('is true when an outstanding invoice is past its due date', () => {
    expect(isOverdue(dueInv('sent', '2026-06-09'), TODAY)).toBe(true)
    expect(isOverdue(dueInv('partial', '2026-01-01'), TODAY)).toBe(true)
  })
  it('is false when due today or in the future', () => {
    expect(isOverdue(dueInv('sent', '2026-06-10'), TODAY)).toBe(false)
    expect(isOverdue(dueInv('sent', '2026-12-31'), TODAY)).toBe(false)
  })
  it('is false for paid/draft even when past due', () => {
    expect(isOverdue(dueInv('paid', '2026-06-09'), TODAY)).toBe(false)
    expect(isOverdue(dueInv('draft', '2026-06-09'), TODAY)).toBe(false)
  })
  it('is false for a voided invoice past its due date', () => {
    expect(isOverdue(dueInv('sent', '2026-06-09', '2026-06-05T00:00:00Z'), TODAY)).toBe(false)
  })
  it('is false when no due date is set', () => {
    expect(isOverdue(dueInv('sent', null), TODAY)).toBe(false)
    expect(isOverdue(dueInv('sent', ''), TODAY)).toBe(false)
  })
})

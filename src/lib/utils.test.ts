import { describe, it, expect } from 'vitest'
import { formatRelativeTime, formatDateTime } from './utils'

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-30T12:00:00Z')
  it('formats a recent past time relative to now', () => {
    expect(formatRelativeTime('2026-06-30T11:55:00Z', now)).toBe('5 minutes ago')
  })
  it('formats hours ago', () => {
    expect(formatRelativeTime('2026-06-30T09:00:00Z', now)).toBe('about 3 hours ago')
  })
})

describe('formatDateTime (Malaysia time)', () => {
  it('renders a UTC instant in MYT (UTC+8)', () => {
    // 13:43 UTC → 21:43 MYT, same calendar day.
    const out = formatDateTime('2026-06-22T13:43:01Z')
    expect(out).toContain('22 Jun 2026')
    expect(out).toMatch(/9:43/)
    expect(out.toLowerCase()).toContain('pm')
  })
  it('rolls to the next calendar day when MYT crosses midnight', () => {
    // 20:00 UTC → 04:00 MYT next day.
    expect(formatDateTime('2026-06-22T20:00:00Z')).toContain('23 Jun 2026')
  })
})

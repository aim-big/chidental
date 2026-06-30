import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './utils'

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-30T12:00:00Z')
  it('formats a recent past time relative to now', () => {
    expect(formatRelativeTime('2026-06-30T11:55:00Z', now)).toBe('5 minutes ago')
  })
  it('formats hours ago', () => {
    expect(formatRelativeTime('2026-06-30T09:00:00Z', now)).toBe('about 3 hours ago')
  })
})

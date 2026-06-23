import { describe, it, expect } from 'vitest'
import { toWhatsAppNumber, whatsAppLink } from './phone'

describe('toWhatsAppNumber', () => {
  it('swaps a leading 0 for the Malaysian country code', () => {
    expect(toWhatsAppNumber('012-3456789')).toBe('60123456789')
  })
  it('keeps a number that already starts with the country code', () => {
    expect(toWhatsAppNumber('60123456789')).toBe('60123456789')
    expect(toWhatsAppNumber('+60 12-345 6789')).toBe('60123456789')
  })
  it('trusts an explicit + international number', () => {
    expect(toWhatsAppNumber('+44 7700 900123')).toBe('447700900123')
  })
  it('prepends the country code to a bare local number', () => {
    expect(toWhatsAppNumber('123456789')).toBe('60123456789')
  })
  it('strips spaces, dashes, and parentheses', () => {
    expect(toWhatsAppNumber('(012) 345-6789')).toBe('60123456789')
  })
  it('returns null when there are no digits', () => {
    expect(toWhatsAppNumber('')).toBeNull()
    expect(toWhatsAppNumber(null)).toBeNull()
    expect(toWhatsAppNumber(undefined)).toBeNull()
    expect(toWhatsAppNumber('---')).toBeNull()
  })
  it('respects an overridden country code', () => {
    expect(toWhatsAppNumber('0912345678', '65')).toBe('65912345678')
  })
})

describe('whatsAppLink', () => {
  it('builds a wa.me url', () => {
    expect(whatsAppLink('012-3456789')).toBe('https://wa.me/60123456789')
  })
  it('returns null for an unusable number', () => {
    expect(whatsAppLink('')).toBeNull()
  })
})

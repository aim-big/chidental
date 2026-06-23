import { describe, it, expect } from 'vitest'
import {
  combineInternational,
  splitInternational,
  flagEmoji,
  countryByIso2,
  COUNTRIES,
} from './country-codes'

describe('combineInternational', () => {
  it('builds E.164 from a Malaysian local number, dropping the trunk 0', () => {
    expect(combineInternational('MY', '012-3456789')).toBe('+60123456789')
  })
  it('builds E.164 for a foreign country', () => {
    expect(combineInternational('GB', '07700 900123')).toBe('+447700900123')
  })
  it('returns empty string when there is no national number', () => {
    expect(combineInternational('MY', '')).toBe('')
    expect(combineInternational('MY', '   ')).toBe('')
  })
})

describe('splitInternational', () => {
  it('defaults to Malaysia and strips the trunk 0 for a legacy local number', () => {
    expect(splitInternational('012-3456789')).toEqual({ iso2: 'MY', national: '123456789' })
  })
  it('recovers country and national from a stored + number', () => {
    expect(splitInternational('+60123456789')).toEqual({ iso2: 'MY', national: '123456789' })
    expect(splitInternational('+447700900123')).toEqual({ iso2: 'GB', national: '7700900123' })
  })
  it('keeps the area code in the national part for shared +1 (NANP)', () => {
    const { national } = splitInternational('+18765551234')
    expect(national).toBe('8765551234')
  })
  it('falls back to default country and empty national for blank input', () => {
    expect(splitInternational('')).toEqual({ iso2: 'MY', national: '' })
    expect(splitInternational(null)).toEqual({ iso2: 'MY', national: '' })
  })
  it('round-trips through combine', () => {
    const { iso2, national } = splitInternational('+6512345678')
    expect(iso2).toBe('SG')
    expect(combineInternational(iso2, national)).toBe('+6512345678')
  })
})

describe('country data', () => {
  it('has unique ISO2 codes', () => {
    const seen = new Set(COUNTRIES.map(c => c.iso2))
    expect(seen.size).toBe(COUNTRIES.length)
  })
  it('every dial code is digits only', () => {
    expect(COUNTRIES.every(c => /^\d+$/.test(c.dial))).toBe(true)
  })
  it('derives a flag emoji from ISO2', () => {
    expect(flagEmoji('MY')).toBe('🇲🇾')
  })
  it('looks up Malaysia', () => {
    expect(countryByIso2('MY')?.dial).toBe('60')
  })
})

import { describe, it, expect } from 'vitest'
import { buildUnitOptions } from './units'

describe('buildUnitOptions', () => {
  it('returns the active labels when current is already among them', () => {
    expect(buildUnitOptions(['unit', 'tooth'], 'tooth')).toEqual(['unit', 'tooth'])
  })
  it('appends current when it is not in the active list', () => {
    expect(buildUnitOptions(['unit', 'tooth'], 'bridge')).toEqual(['unit', 'tooth', 'bridge'])
  })
  it('returns active unchanged for empty, null, or undefined current', () => {
    expect(buildUnitOptions(['unit', 'tooth'], '')).toEqual(['unit', 'tooth'])
    expect(buildUnitOptions(['unit', 'tooth'], null)).toEqual(['unit', 'tooth'])
    expect(buildUnitOptions(['unit', 'tooth'], undefined)).toEqual(['unit', 'tooth'])
  })
  it('handles an empty active list', () => {
    expect(buildUnitOptions([], 'set')).toEqual(['set'])
  })
})

import { afterEach, describe, it, expect } from 'vitest'
import { presetRange, buildPresets, matchPreset, resolveDateRange } from './reports-presets'

// The helper itself pins presets to the lab's Malaysia calendar; this midday
// fixture keeps the basic preset expectations away from timezone boundaries.
const NOW = new Date('2026-06-15T10:00:00')
const ORIGINAL_TZ = process.env.TZ

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

describe('presetRange', () => {
  it('this month', () => {
    expect(presetRange('month', NOW)).toEqual({ from: '2026-06-01', to: '2026-06-30' })
  })
  it('last month', () => {
    expect(presetRange('lastMonth', NOW)).toEqual({ from: '2026-05-01', to: '2026-05-31' })
  })
  it('this quarter (Q2 Apr–Jun)', () => {
    expect(presetRange('quarter', NOW)).toEqual({ from: '2026-04-01', to: '2026-06-30' })
  })
  it('year to date ends today', () => {
    expect(presetRange('ytd', NOW)).toEqual({ from: '2026-01-01', to: '2026-06-15' })
  })
  it('uses the Malaysia calendar when the server timezone is UTC', () => {
    process.env.TZ = 'UTC'
    const malaysiaJulyFirst = new Date('2026-06-30T17:00:00Z')

    expect(presetRange('month', malaysiaJulyFirst)).toEqual({ from: '2026-07-01', to: '2026-07-31' })
    expect(presetRange('ytd', malaysiaJulyFirst)).toEqual({ from: '2026-01-01', to: '2026-07-01' })
  })
})

describe('matchPreset', () => {
  const presets = buildPresets(NOW)
  it('round-trips each named preset', () => {
    for (const k of ['month', 'lastMonth', 'quarter', 'ytd'] as const) {
      expect(matchPreset(presets[k].from, presets[k].to, presets)).toBe(k)
    }
  })
  it('returns custom for an arbitrary range', () => {
    expect(matchPreset('2026-06-03', '2026-06-09', presets)).toBe('custom')
  })
})

describe('resolveDateRange', () => {
  it('keeps a valid URL range', () => {
    expect(resolveDateRange({ from: '2026-06-03', to: '2026-06-09' }, NOW)).toEqual({
      from: '2026-06-03',
      to: '2026-06-09',
    })
  })

  it('falls back to this month for invalid date strings', () => {
    expect(resolveDateRange({ from: 'not-a-date', to: '2026-06-30' }, NOW)).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    })
    expect(resolveDateRange({ from: '2026-02-31', to: '2026-06-30' }, NOW)).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    })
  })

  it('falls back to this month when from is after to', () => {
    expect(resolveDateRange({ from: '2026-06-30', to: '2026-06-01' }, NOW)).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    })
  })
})

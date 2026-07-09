import { describe, it, expect } from 'vitest'
import { diffFields } from './diff'

const LABELS = { due_date: 'Due date', patient: 'Patient', total: 'Total' }

describe('diffFields', () => {
  it('returns only changed labelled fields', () => {
    const out = diffFields(
      { due_date: '2026-06-01', patient: 'A', total: 100, ignored: 'x' },
      { due_date: '2026-06-15', patient: 'A', total: 100, ignored: 'y' },
      LABELS,
    )
    expect(out).toEqual([{ field: 'due_date', label: 'Due date', from: '2026-06-01', to: '2026-06-15' }])
  })

  it('treats null, undefined and empty string as equal', () => {
    const out = diffFields({ patient: null }, { patient: '' }, LABELS)
    expect(out).toEqual([])
  })

  it('detects a real string change from empty to value', () => {
    const out = diffFields({ patient: null }, { patient: 'Jane' }, LABELS)
    expect(out).toEqual([{ field: 'patient', label: 'Patient', from: null, to: 'Jane' }])
  })

  it('compares numbers by value not type', () => {
    const out = diffFields({ total: 100 }, { total: '100' }, LABELS)
    expect(out).toEqual([])
  })

  it('returns empty array when nothing changed', () => {
    expect(diffFields({ patient: 'A' }, { patient: 'A' }, LABELS)).toEqual([])
  })
})

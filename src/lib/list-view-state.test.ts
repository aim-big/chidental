// src/lib/list-view-state.test.ts
import { describe, it, expect } from 'vitest'
import { listViewState } from './list-view-state'

describe('listViewState', () => {
  it('is loading when loading is true regardless of counts', () => {
    expect(listViewState({ loading: true, total: 5, filtered: 5, hasQuery: false })).toBe('loading')
  })
  it('is empty-first-run when there is no underlying data', () => {
    expect(listViewState({ loading: false, total: 0, filtered: 0, hasQuery: false })).toBe('empty-first-run')
  })
  it('is empty-no-results when a query filters everything out', () => {
    expect(listViewState({ loading: false, total: 5, filtered: 0, hasQuery: true })).toBe('empty-no-results')
  })
  it('is rows when there are visible items', () => {
    expect(listViewState({ loading: false, total: 5, filtered: 3, hasQuery: true })).toBe('rows')
  })
})

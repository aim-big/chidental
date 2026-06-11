import { describe, it, expect } from 'vitest'
import {
  WORK_STATUSES, WORK_STATUS_LABELS, WORK_STATUS_COLORS,
  nextWorkStatus, dominantWorkStatus,
} from '@/lib/work-status'

describe('work statuses (qc removed)', () => {
  it('no longer lists qc', () => {
    expect(WORK_STATUSES).toEqual(['received', 'in_progress', 'ready', 'delivered', 'on_hold'])
    expect('qc' in WORK_STATUS_LABELS).toBe(false)
    expect('qc' in WORK_STATUS_COLORS).toBe(false)
  })
  it('flows in_progress straight to ready (no qc step)', () => {
    expect(nextWorkStatus('in_progress')).toBe('ready')
    expect(nextWorkStatus('received')).toBe('in_progress')
    expect(nextWorkStatus('delivered')).toBeNull()
  })
  it('still resolves a dominant status, preferring on_hold then least-progressed', () => {
    expect(dominantWorkStatus(['ready', 'on_hold', 'received'])).toBe('on_hold')
    expect(dominantWorkStatus(['ready', 'received'])).toBe('received')
    expect(dominantWorkStatus([])).toBeNull()
  })
})

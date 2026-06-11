import { describe, it, expect } from 'vitest'
import type { WorkStatus, WorkStage } from '@/lib/database.types'
import {
  encodeWork, decodeWork, workOptions, workOptionsForItem,
  workLabel, workColor, labelForValue, colorForValue,
  orderedGroupKeys, STAGE_DEFAULT_COLOR,
} from '@/lib/work-stages'
import { WORK_STATUS_LABELS, WORK_STATUS_COLORS } from '@/lib/work-status'

const stage = (
  id: string, label: string, sort: number,
  color: string | null = null, is_active = true,
): WorkStage => ({ id, label, color, sort_order: sort, is_active, created_at: '2026-06-11T00:00:00Z' })

const tray = stage('s1', 'Custom Tray', 10, 'bg-blue-100 text-blue-700')
const tryin = stage('s2', 'Try-in', 20, 'bg-amber-100 text-amber-700')
const active = [tray, tryin]
const byId = new Map(active.map(s => [s.id, s]))

describe('encodeWork / decodeWork', () => {
  it('round-trips every phase and stage', () => {
    const cases: Array<[WorkStatus, string | null]> = [
      ['received', null], ['in_progress', 's1'], ['in_progress', null],
      ['ready', null], ['delivered', null], ['on_hold', null],
    ]
    for (const [ws, sid] of cases) {
      expect(decodeWork(encodeWork(ws, sid))).toEqual({ work_status: ws, stage_id: sid })
    }
  })
  it('encodes a staged in_progress as "stage:<id>"', () => {
    expect(encodeWork('in_progress', 's1')).toBe('stage:s1')
  })
  it('encodes a stage-less in_progress as "in_progress"', () => {
    expect(encodeWork('in_progress', null)).toBe('in_progress')
  })
})

describe('workOptions', () => {
  it('lists Received, active stages in order, then Ready/Delivered/On Hold', () => {
    expect(workOptions(active).map(o => o.value)).toEqual([
      'received', 'stage:s1', 'stage:s2', 'ready', 'delivered', 'on_hold',
    ])
  })
  it('uses the stage color, falling back to the default', () => {
    const noColor = [stage('s3', 'Bake', 30, null)]
    expect(workOptions(noColor)[1]).toEqual({ value: 'stage:s3', label: 'Bake', color: STAGE_DEFAULT_COLOR })
  })
})

describe('workOptionsForItem', () => {
  it('returns the base options when the current value is already present', () => {
    expect(workOptionsForItem(active, 'received', null, byId)).toEqual(workOptions(active))
  })
  it('injects an inactive stage the item still sits on, right after Received', () => {
    const inactive = stage('old', 'Wax Up', 99, 'bg-pink-100 text-pink-700', false)
    const map = new Map([...byId, [inactive.id, inactive]])
    const opts = workOptionsForItem(active, 'in_progress', 'old', map)
    expect(opts.map(o => o.value)).toEqual([
      'received', 'stage:old', 'stage:s1', 'stage:s2', 'ready', 'delivered', 'on_hold',
    ])
    expect(opts[1]).toEqual({ value: 'stage:old', label: 'Wax Up', color: 'bg-pink-100 text-pink-700' })
  })
  it('injects a stage-less In Progress item', () => {
    const opts = workOptionsForItem(active, 'in_progress', null, byId)
    const inProg = opts.find(o => o.value === 'in_progress')
    expect(inProg?.label).toBe(WORK_STATUS_LABELS.in_progress)
  })
})

describe('workLabel / workColor', () => {
  it('uses the stage label+color for an active staged item', () => {
    expect(workLabel('in_progress', 's1', byId)).toBe('Custom Tray')
    expect(workColor('in_progress', 's1', byId)).toBe('bg-blue-100 text-blue-700')
  })
  it('falls back to the phase label+color for non-stage statuses', () => {
    expect(workLabel('ready', null, byId)).toBe(WORK_STATUS_LABELS.ready)
    expect(workColor('ready', null, byId)).toBe(WORK_STATUS_COLORS.ready)
  })
  it('falls back to In Progress when the stage is unknown or missing', () => {
    expect(workLabel('in_progress', 'gone', byId)).toBe(WORK_STATUS_LABELS.in_progress)
    expect(workColor('in_progress', null, byId)).toBe(WORK_STATUS_COLORS.in_progress)
  })
})

describe('labelForValue / colorForValue', () => {
  it('decodes a group-key value then resolves label + color', () => {
    expect(labelForValue('stage:s2', byId)).toBe('Try-in')
    expect(colorForValue('stage:s2', byId)).toBe('bg-amber-100 text-amber-700')
    expect(labelForValue('ready', byId)).toBe(WORK_STATUS_LABELS.ready)
  })
})

describe('orderedGroupKeys', () => {
  it('orders present groups canonically', () => {
    const present = ['ready', 'stage:s2', 'received', 'on_hold']
    expect(orderedGroupKeys(active, present)).toEqual(['received', 'stage:s2', 'ready', 'on_hold'])
  })
  it('places inactive-stage / stage-less groups at the end of the In Progress region', () => {
    const present = ['received', 'stage:old', 'in_progress', 'ready']
    expect(orderedGroupKeys(active, present)).toEqual(['received', 'stage:old', 'in_progress', 'ready'])
  })
  it('de-dupes repeated present keys', () => {
    const present = ['received', 'received', 'stage:s1', 'stage:s1']
    expect(orderedGroupKeys(active, present)).toEqual(['received', 'stage:s1'])
  })
  it('still emits an extra group when no Ready items are present', () => {
    // Guards the subtle "flush extras at the canonical Ready position" logic: a
    // refactor that gated the flush on `ready` being present would drop this group.
    const present = ['received', 'stage:old']
    expect(orderedGroupKeys(active, present)).toEqual(['received', 'stage:old'])
  })
})

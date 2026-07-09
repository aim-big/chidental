import { describe, it, expect } from 'vitest'
import { ok, fail } from './action-result'
describe('action-result', () => {
  it('wraps success', () => expect(ok(42)).toEqual({ ok: true, data: 42 }))
  it('wraps failure', () => expect(fail('nope')).toEqual({ ok: false, error: 'nope' }))
})

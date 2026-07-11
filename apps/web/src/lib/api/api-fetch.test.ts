import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './api-fetch'

// Node reports "API server not running" as `TypeError: fetch failed` — opaque to
// anyone who doesn't know the local stack is three servers. These tests pin the
// mapping to an actionable message (and pin that everything else passes through).
describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('maps connection failures to an actionable message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(apiFetch('http://localhost:6061/customers')).rejects.toThrow(
      'Cannot reach the API at http://localhost:6061.',
    )
  })

  it('adds the pnpm dev hint in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(apiFetch('http://localhost:6061/customers')).rejects.toThrow(
      'Cannot reach the API at http://localhost:6061 — is the API server running? `pnpm dev` starts web + API together.',
    )
  })

  it('preserves the original error as cause', async () => {
    const original = new TypeError('fetch failed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(original))
    const err = await apiFetch('http://localhost:6061/x').catch((e: unknown) => e)
    expect((err as Error).cause).toBe(original)
  })

  it('returns successful responses untouched', async () => {
    const res = new Response('{}', { status: 200 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res))
    await expect(apiFetch('http://localhost:6061/x')).resolves.toBe(res)
  })

  it('does not wrap non-TypeError failures (e.g. aborts)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')))
    await expect(apiFetch('http://localhost:6061/x')).rejects.toThrow('aborted')
  })
})

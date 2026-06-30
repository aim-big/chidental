import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUser = vi.fn()
const single = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}))

import { requirePermission, requireSuperadmin } from './require-permission'

beforeEach(() => {
  getUser.mockReset(); single.mockReset()
})

const profile = (over: Record<string, unknown> = {}) => ({
  active: true,
  full_name: 'Alice Tan',
  username: 'alice',
  roles: { is_system: false, role_permissions: [{ permission: 'invoices.manage' }] },
  ...over,
})

describe('requirePermission actorName', () => {
  it('returns actorName from full_name on success', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    single.mockResolvedValue({ data: profile() })
    const res = await requirePermission('invoices.manage')
    expect(res).toEqual({ ok: true, userId: 'u1', actorName: 'Alice Tan' })
  })

  it('falls back to username when full_name is null', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u2' } } })
    single.mockResolvedValue({ data: profile({ full_name: null }) })
    const res = await requirePermission('invoices.manage')
    expect(res).toEqual({ ok: true, userId: 'u2', actorName: 'alice' })
  })

  it('superadmin also returns actorName', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u3' } } })
    single.mockResolvedValue({ data: profile({ roles: { is_system: true, role_permissions: [] } }) })
    const res = await requireSuperadmin()
    expect(res).toEqual({ ok: true, userId: 'u3', actorName: 'Alice Tan' })
  })
})

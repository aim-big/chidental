import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Vary the "logged-in" user per test via a module-level handle the mock reads.
let currentUser: { id: string } | null = null
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}))

import { updateSession } from './middleware'

const req = (path: string, method = 'GET') =>
  new NextRequest(new URL(`http://localhost:6060${path}`), { method })

beforeEach(() => {
  currentUser = null
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'dummy-anon-key')
})

describe('updateSession auth gating', () => {
  it('redirects an unauthenticated GET navigation to /login', async () => {
    currentUser = null
    const res = await updateSession(req('/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('does not redirect an unauthenticated request already on /login', async () => {
    currentUser = null
    const res = await updateSession(req('/login'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('redirects a logged-in user away from /login to /dashboard', async () => {
    currentUser = { id: 'u1' }
    const res = await updateSession(req('/login'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('lets a logged-in user reach a protected page', async () => {
    currentUser = { id: 'u1' }
    const res = await updateSession(req('/invoices'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('never redirects a mutating POST, even unauthenticated (server action safety)', async () => {
    currentUser = null
    const res = await updateSession(req('/invoices', 'POST'))
    expect(res.headers.get('location')).toBeNull()
  })
})

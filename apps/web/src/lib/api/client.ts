// Server-side client for the NestJS API. Attaches the current user's Supabase
// access token so the API's auth guard can verify the session + permissions.
// Used only by the per-module strangler seams in `src/data/*` (behind the
// USE_API_MODULES flag) — components never call this directly.
import { createClient } from '@/lib/supabase/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiGet<T>(path: string): Promise<T> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL is not set — cannot route module to the API')
  const res = await fetch(`${API_URL}${path}`, {
    headers: await authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`API GET ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

// Like apiGet, but a 404 resolves to `null` instead of throwing. The seam for
// "fetch a single row, may not exist" reads (detail/edit/statement), where the
// Next query returns `null` for a missing row and the API answers 404. Other
// non-2xx statuses still throw — a real failure must not masquerade as absent.
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL is not set — cannot route module to the API')
  const res = await fetch(`${API_URL}${path}`, {
    headers: await authHeaders(),
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`API GET ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

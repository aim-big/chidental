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

// Map the API's auth/permission status codes back to the EXACT ActionResult
// error strings the web `requirePermission` produces, so a write routed to the
// API is indistinguishable from the local action. Validation + DB failures are
// returned by the controller as a 200 `{ ok: false, error }` body (preserving
// their messages verbatim) and never reach here.
function mapAuthError(status: number, apiError: string | undefined): string {
  if (status === 403) return 'You do not have permission to do this.'
  if (status === 401) return apiError?.includes('No active profile') ? 'Access denied' : 'Not signed in'
  return apiError ?? 'Request failed'
}

/**
 * Write seam: POST/PATCH/DELETE a JSON body and return the API's `ActionResult`.
 * Write endpoints answer 200 with the `ActionResult` body for everything the
 * handler owns (validation, DB error, success) — so those pass straight through.
 * Only the global guard's auth/permission rejections are status-coded (401/403),
 * which we translate back to the same `{ ok: false, error }` the local action
 * returns. `revalidatePath` stays in the calling server action.
 */
export async function apiSend<T extends { ok: boolean }>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL is not set — cannot route module to the API')
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  if (res.ok) return (await res.json()) as T
  let apiError: string | undefined
  try {
    apiError = ((await res.json()) as { error?: string }).error
  } catch {
    /* no JSON body */
  }
  return { ok: false, error: mapAuthError(res.status, apiError) } as unknown as T
}

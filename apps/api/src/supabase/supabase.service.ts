import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../config/env.validation'

/**
 * Wraps the Supabase clients the API uses:
 *  - `admin`  : service-role client. Bypasses RLS — the API's own auth guard +
 *               permission checks are the enforcement boundary (mandatory from
 *               module one, per the migration plan's RLS-bypass risk).
 *  - `verifyAccessToken(jwt)` : validates a user's Supabase access token and
 *               returns the auth user (id, email). Used by the auth guard.
 */
@Injectable()
export class SupabaseService {
  readonly admin: SupabaseClient
  private readonly url: string
  private readonly anonKey: string

  constructor(private readonly config: ConfigService<Env, true>) {
    this.url = this.config.get('SUPABASE_URL', { infer: true })
    const serviceRoleKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true })
    this.anonKey = this.config.get('SUPABASE_ANON_KEY', { infer: true })
    this.admin = createClient(this.url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  /**
   * A Supabase client scoped to a specific user's access token: PostgREST runs
   * the request AS that authenticated user, so RLS applies and `auth.uid()` /
   * `auth.jwt()` resolve inside triggers. Required where a DB trigger records the
   * actor (e.g. invoice_item_status_history) — the service-role `admin` client
   * has no session and would log a null actor.
   */
  forUser(accessToken: string): SupabaseClient {
    return createClient(this.url, this.anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }

  /** Validate a user access token against Supabase Auth. Returns the user or null. */
  async verifyAccessToken(jwt: string): Promise<{ id: string; email: string | null } | null> {
    const { data, error } = await this.admin.auth.getUser(jwt)
    if (error || !data?.user) return null
    return { id: data.user.id, email: data.user.email ?? null }
  }
}

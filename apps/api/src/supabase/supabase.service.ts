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

  constructor(private readonly config: ConfigService<Env, true>) {
    const url = this.config.get('SUPABASE_URL', { infer: true })
    const serviceRoleKey = this.config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true })
    this.admin = createClient(url, serviceRoleKey, {
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

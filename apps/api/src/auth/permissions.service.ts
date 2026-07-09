import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'

export type AuthContext = {
  userId: string
  email: string | null
  isSuperAdmin: boolean
  permissions: Set<string>
  // Display-name snapshot for audit/activity rows — full_name, then username
  // (mirrors the web requirePermission actorName).
  actorName: string
}

/**
 * Resolves a user's authorization context from the DB, mirroring the Postgres
 * `auth_has_permission(perm)` rule exactly:
 *   active profile AND (role.is_system OR role_permissions contains perm).
 * This is the API's single enforcement point — the service-role client bypasses
 * RLS, so every request must pass through here.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async contextFor(userId: string, email: string | null): Promise<AuthContext | null> {
    // Active profile + its role.
    const { data: profile } = await this.supabase.admin
      .from('profiles')
      .select('id, active, role_id, full_name, username, roles(is_system)')
      .eq('id', userId)
      .maybeSingle()

    if (!profile || profile.active !== true) return null

    const role = profile.roles as unknown as { is_system: boolean } | null
    const isSuperAdmin = role?.is_system === true

    let permissions = new Set<string>()
    if (!isSuperAdmin && profile.role_id) {
      const { data: perms } = await this.supabase.admin
        .from('role_permissions')
        .select('permission')
        .eq('role_id', profile.role_id)
      permissions = new Set((perms ?? []).map((p) => p.permission as string))
    }

    const actorName =
      (profile.full_name as string | null) ?? (profile.username as string | null) ?? '(unknown)'

    return { userId, email, isSuperAdmin, permissions, actorName }
  }

  has(ctx: AuthContext, permission: string): boolean {
    return ctx.isSuperAdmin || ctx.permissions.has(permission)
  }
}

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { SupabaseService } from '../supabase/supabase.service'
import { PermissionsService, type AuthContext } from './permissions.service'
import { IS_PUBLIC } from './public.decorator'
import { REQUIRE_PERMISSION } from './require-permission.decorator'

// The request carries the resolved auth context once the guard passes.
export type AuthedRequest = Request & { auth?: AuthContext }

/**
 * Global guard:
 *  1. `@Public()` routes skip auth entirely (health probe).
 *  2. Otherwise require a valid Supabase access token (Authorization: Bearer …).
 *  3. Resolve the user's AuthContext (active profile + role + permissions).
 *  4. If the route declares `@RequirePermission('x')`, enforce it.
 *  5. Attach the context to the request for handlers to use.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<AuthedRequest>()
    const token = this.bearerToken(req)
    if (!token) throw new UnauthorizedException('Missing bearer token')

    const user = await this.supabase.verifyAccessToken(token)
    if (!user) throw new UnauthorizedException('Invalid or expired token')

    const ctx = await this.permissions.contextFor(user.id, user.email)
    if (!ctx) throw new UnauthorizedException('No active profile for this user')

    const required = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ])
    if (required && !this.permissions.has(ctx, required)) {
      throw new ForbiddenException(`Missing permission: ${required}`)
    }

    req.auth = ctx
    return true
  }

  private bearerToken(req: Request): string | null {
    const header = req.headers['authorization']
    if (!header || Array.isArray(header)) return null
    const [scheme, value] = header.split(' ')
    return scheme?.toLowerCase() === 'bearer' && value ? value : null
  }
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthedRequest } from './supabase-auth.guard'
import type { AuthContext } from './permissions.service'

// Handler param decorators for the auth state the guard attaches to the request.

/** The resolved auth context (userId, actorName, permissions). */
export const Auth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>()
  // The global guard runs first on every non-@Public route, so auth is set.
  return req.auth as AuthContext
})

/** The caller's raw Supabase access token (for SupabaseService.forUser). */
export const AccessToken = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>()
  return req.accessToken as string
})

import { Controller, Get, Req } from '@nestjs/common'
import type { AuthedRequest } from '../auth/supabase-auth.guard'

// Authenticated round-trip: proves the guard resolved a valid Supabase session
// and its permission context. Requires a valid Bearer token (no @Public).
@Controller('me')
export class MeController {
  @Get()
  me(@Req() req: AuthedRequest) {
    const ctx = req.auth!
    return {
      userId: ctx.userId,
      email: ctx.email,
      isSuperAdmin: ctx.isSuperAdmin,
      permissions: [...ctx.permissions].sort(),
    }
  }
}

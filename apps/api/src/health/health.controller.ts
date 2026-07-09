import { Controller, Get } from '@nestjs/common'
import { idSchema } from '@chidental/shared'
import { Public } from '../auth/public.decorator'

@Controller('health')
export class HealthController {
  // Public liveness probe (Railway healthcheck + uptime monitors). No auth.
  //
  // `shared` proves the API can consume @chidental/shared at RUNTIME: idSchema is
  // a Zod schema resolved through the package's `require` → dist (CJS) condition
  // and executed here. This is the exact capability the write modules depend on
  // (their DTOs are shared Zod schemas), so the healthcheck fails loudly if the
  // shared build/link ever regresses in a deploy.
  @Public()
  @Get()
  check() {
    const shared = idSchema.safeParse('123e4567-e89b-42d3-a456-426614174000').success
    return { status: 'ok', service: 'chidental-api', uptime: process.uptime(), shared }
  }
}

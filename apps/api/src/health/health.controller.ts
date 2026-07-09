import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/public.decorator'

@Controller('health')
export class HealthController {
  // Public liveness probe (Railway healthcheck + uptime monitors). No auth.
  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'chidental-api', uptime: process.uptime() }
  }
}

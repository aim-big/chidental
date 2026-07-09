import { Global, Module } from '@nestjs/common'
import { ActivityLogService } from './activity-log.service'

// Global so any feature module (work, invoices) can inject ActivityLogService
// without re-importing.
@Global()
@Module({
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class AuditModule {}

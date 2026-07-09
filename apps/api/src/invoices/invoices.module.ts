import { Module } from '@nestjs/common'
import { InvoicesController } from './invoices.controller'
import { BillingSnapshotService } from './billing-snapshot.service'

@Module({
  controllers: [InvoicesController],
  providers: [BillingSnapshotService],
})
export class InvoicesModule {}

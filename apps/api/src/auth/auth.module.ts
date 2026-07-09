import { Global, Module } from '@nestjs/common'
import { PermissionsService } from './permissions.service'

// PermissionsService is shared with the global guard (registered in AppModule).
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class AuthModule {}

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { validateEnv } from './config/env.validation'
import { SupabaseModule } from './supabase/supabase.module'
import { AuthModule } from './auth/auth.module'
import { SupabaseAuthGuard } from './auth/supabase-auth.guard'
import { AllExceptionsFilter } from './common/all-exceptions.filter'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SupabaseModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    // Auth guard runs on every route (opt out with @Public); the DB-backed
    // permission check is the API's enforcement boundary since the service-role
    // client bypasses RLS.
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

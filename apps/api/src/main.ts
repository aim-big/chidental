import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import type { Env } from './config/env.validation'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false })
  const config = app.get(ConfigService<Env, true>)

  // CORS: allow the configured web origins (comma-separated) to call the API
  // with the user's Supabase access token.
  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  app.enableCors({ origin: origins, credentials: true })

  // Input validation is done with Zod (nestjs-zod pipes per-DTO in Phase 3),
  // not class-validator — so no global ValidationPipe here.

  // Railway provides PORT; fall back to the validated API_PORT (6061 locally).
  const port = Number(process.env.PORT) || config.get('API_PORT', { infer: true })
  await app.listen(port, '0.0.0.0')
  new Logger('Bootstrap').log(`chidental-api listening on :${port} (env ${config.get('NODE_ENV', { infer: true })})`)
}

void bootstrap()

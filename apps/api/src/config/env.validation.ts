import { z } from 'zod'

// Env contract for the API. Validated at boot (ConfigModule.validate) so a
// misconfigured deploy fails fast and loudly instead of at first request.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(6061),

  // Supabase — the API talks to Postgres/Auth with the service-role key and
  // verifies incoming user JWTs against the same project.
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),

  // Comma-separated list of allowed web origins for CORS (e.g. the Vercel app).
  CORS_ORIGINS: z.string().default('http://localhost:6060'),
})

export type Env = z.infer<typeof envSchema>

// @nestjs/config `validate` hook: receives raw process.env, returns the parsed
// (and coerced) config or throws with a readable message.
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid API environment:\n${issues}`)
  }
  return parsed.data
}

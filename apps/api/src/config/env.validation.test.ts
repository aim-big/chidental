import { describe, it, expect } from 'vitest'
import { validateEnv, envSchema } from './env.validation'

const base = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  SUPABASE_ANON_KEY: 'anon',
}

describe('validateEnv', () => {
  it('accepts a valid env and applies defaults', () => {
    const env = validateEnv(base)
    expect(env.API_PORT).toBe(6061)
    expect(env.NODE_ENV).toBe('development')
    expect(env.CORS_ORIGINS).toBe('http://localhost:6060')
  })

  it('coerces API_PORT from a string', () => {
    expect(validateEnv({ ...base, API_PORT: '8080' }).API_PORT).toBe(8080)
  })

  it('throws a readable error when a required var is missing', () => {
    expect(() => validateEnv({ SUPABASE_URL: 'http://x.co' })).toThrow(/Invalid API environment/)
  })

  it('rejects a non-URL SUPABASE_URL', () => {
    expect(envSchema.safeParse({ ...base, SUPABASE_URL: 'not-a-url' }).success).toBe(false)
  })
})

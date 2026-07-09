import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Integration tests run against a live Postgres with the project's migrations
// applied (the local Supabase stack). Run with:  npm run test:integration
// after `supabase start`. Connection defaults to the local DB; override with
// SUPABASE_DB_URL. See src/integration/db.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    // Each test file owns one pg connection and serializes work via per-test
    // transactions; keep files from racing on the same database.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})

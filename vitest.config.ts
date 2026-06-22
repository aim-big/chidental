import { defineConfig, configDefaults } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Integration tests need a live Postgres (see vitest.integration.config.ts);
    // keep them out of the default unit gate so `npm test` runs without a DB.
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
  },
})

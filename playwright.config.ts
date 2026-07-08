import { defineConfig, devices } from '@playwright/test'

// E2E smoke tests. Not part of the plain CI gate — they need the app running on
// 6060 against a seeded local Supabase stack (supabase start + db reset). Run:
//   npm run test:e2e
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:6060',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Reuse an already-running dev server if present; otherwise start one.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:6060/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})

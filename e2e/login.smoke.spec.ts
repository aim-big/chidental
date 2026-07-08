import { test, expect } from '@playwright/test'
import { login } from './helpers'

test('unauthenticated navigation is gated to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('a seeded user can log in and reach the app', async ({ page }) => {
  await login(page)
  await expect(page).toHaveURL(/\/dashboard/)
})

import { type Page, expect } from '@playwright/test'

// Matches supabase/seed.sql. Staff auth is User ID + 6-digit PIN
// (src/app/login/page.tsx): the User ID maps to a synthetic email and the PIN
// is the Supabase password.
export const SEED_USER = { userId: 'seedowner', pin: '123456' }

export async function login(page: Page, user = SEED_USER) {
  await page.goto('/login')
  await page.getByLabel('User ID').fill(user.userId)
  await page.getByLabel(/PIN/i).fill(user.pin)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

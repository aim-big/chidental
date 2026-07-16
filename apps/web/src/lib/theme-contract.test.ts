import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY } from './theme'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

describe('Daylight Ledger theme contract', () => {
  it('restores the original Chi Dental sidebar colour', () => {
    expect(css).toContain('--rail: #766254;')
  })

  it('defines a neutral daylight workspace', () => {
    expect(css).toContain('--workspace: oklch(0.975 0.004 255);')
    expect(css).toContain('--color-workspace: var(--workspace);')
  })

  it('starts existing installations in the new light theme', () => {
    expect(THEME_STORAGE_KEY).toBe('chidental-theme-v2')
  })
})

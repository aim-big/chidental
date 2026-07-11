'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

// Light/dark toggle. The pre-paint script in the root layout applies the stored
// preference before hydration; this button flips it and persists the choice.
export function ThemeToggle({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    setMounted(true)
  }, [])

  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('chidental-theme', next ? 'dark' : 'light') } catch {}
    setDark(next)
  }

  const label = dark ? 'Light mode' : 'Dark mode'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-10 items-center rounded-md text-sm font-medium text-rail-muted transition-colors hover:bg-white/5 hover:text-rail-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
        collapsed ? 'w-full justify-center px-0' : 'w-full gap-3 px-3',
        className,
      )}
    >
      {/* Avoid a hydration mismatch: render a neutral icon until mounted. */}
      {mounted && dark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      {!collapsed && <span suppressHydrationWarning>{mounted ? label : 'Dark mode'}</span>}
    </button>
  )
}

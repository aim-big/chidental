'use client'

// Redesigned app shell for the /demo preview: taupe brand sidebar + slim top bar
// wrapping every demo tab, so the set is clickable as one coherent app. Settings
// and Profile appear but are marked out-of-scope for this first pass.

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, Wrench, Package, BarChart3,
  Settings, UserRound, Search, Menu, X, ArrowUpRight, LogOut, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type NavItem = { href: string; label: string; icon: LucideIcon }

const NAV: NavItem[] = [
  { href: '/demo/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/demo/clinics', label: 'Clinics', icon: Users },
  { href: '/demo/invoices', label: 'Invoices', icon: FileText },
  { href: '/demo/work', label: 'Work', icon: Wrench },
  { href: '/demo/service', label: 'Service', icon: Package },
  { href: '/demo/reports', label: 'Reports', icon: BarChart3 },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-primary text-primary-foreground">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-foreground text-sm font-bold text-primary">C</span>
        <span className="text-[15px] font-semibold tracking-tight">Chidental</span>
        <span className="ml-auto rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-foreground/80">
          Demo
        </span>
      </div>

      <div className="mx-4 border-t border-primary-foreground/10" />

      {/* Search (decorative in the demo) */}
      <div className="px-3 pt-3">
        <div className="flex h-9 items-center gap-2 rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 px-3 text-sm text-primary-foreground/55">
          <Search className="h-4 w-4" />
          <span className="flex-1">Search…</span>
          <kbd className="rounded border border-primary-foreground/15 px-1 text-[10px]">⌘K</kbd>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-primary-foreground/40">Workspace</p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                active
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
              {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />}
            </Link>
          )
        })}

        <div className="mx-1 my-2 border-t border-primary-foreground/10" />
        {[{ label: 'Settings', icon: Settings }, { label: 'Profile', icon: UserRound }].map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="flex h-10 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium text-primary-foreground/35"
            title="Not part of this first redesign pass"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
            <span className="ml-auto rounded-full bg-primary-foreground/10 px-1.5 py-0.5 text-[10px] text-primary-foreground/50">soon</span>
          </div>
        ))}
      </nav>

      <div className="mx-4 border-t border-primary-foreground/10" />

      {/* User chip */}
      <div className="flex items-center gap-3 p-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-foreground/15 text-sm font-semibold">AL</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-primary-foreground">Amira Lai</p>
          <p className="text-xs text-primary-foreground/50">Lab manager</p>
        </div>
        <Link href="/dashboard" className="rounded-md p-1.5 text-primary-foreground/60 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground" title="Sign out (back to live app)">
          <LogOut className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

export function DemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const section = NAV.find((n) => isActive(pathname, n.href))?.label ?? 'Demo'

  return (
    <div className="flex h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 md:block">
        <Sidebar pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(17rem,calc(100vw-2.5rem))] shadow-xl">
            <Sidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span className="text-sm font-medium text-foreground">{section}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground sm:inline">Redesign demo</span>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Live app <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

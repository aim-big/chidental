'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Settings, LogOut, Menu, X, ChevronLeft, ChevronRight, Search, UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/contexts/AuthContext'
import { mainNav, settingsGroups, guardFor, type NavEntry } from '@/domain/navigation'
import { cn } from '@/lib/utils'
import CommandPalette from '@/components/command-palette'

function SidebarTooltip({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed: boolean
  children: React.ReactElement
}) {
  if (!collapsed) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

// Declared at module scope (not inside AppShell's render) so the component keeps
// a stable identity across renders — see react-hooks/static-components.
function SidebarContent({
  items,
  activeHref,
  showSettings,
  username,
  roleName,
  onNavigate,
  onSignOut,
  collapsed,
  onToggleCollapsed,
}: {
  items: NavEntry[]
  activeHref: string
  showSettings: boolean
  username: string
  roleName: string
  onNavigate: () => void
  onSignOut: () => void
  collapsed: boolean
  onToggleCollapsed?: () => void
}) {
  const linkClass = (active: boolean) =>
    cn(
      'flex h-10 items-center rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-rail',
      collapsed ? 'justify-center px-0' : 'gap-3 px-3',
      active
        ? 'bg-rail-selected text-brand'
        : 'text-rail-muted hover:bg-rail-hover hover:text-rail-foreground',
    )

  return (
    <TooltipProvider delayDuration={150}>
      <div className="relative flex h-full flex-col">
        <div className={cn('border-b border-rail-border px-5 pb-4 pt-5', collapsed && 'px-3')}>
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-start')}>
            {collapsed ? (
              <Image
                src="/chidental-square.png"
                alt="Chi Dental Lab"
                width={40}
                height={40}
                priority
                className="h-10 w-10 object-contain"
              />
            ) : (
              <Image
                src="/chidental-rectangle.png"
                alt="Chi Dental Lab"
                width={180}
                height={48}
                priority
                className="h-auto w-full max-w-[188px] object-contain object-left"
              />
            )}
          </div>
        </div>

        {/* Search button */}
        <div className={cn('px-3 pb-2 pt-3', collapsed && 'px-2')}>
          <SidebarTooltip label="Search" collapsed={collapsed}>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('command-palette:open'))}
              className={cn(
                'flex h-10 w-full items-center rounded-md border border-rail-border bg-rail-hover text-sm text-rail-muted transition-colors duration-150 hover:bg-white/15 hover:text-rail-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-rail',
                collapsed ? 'justify-center px-0' : 'gap-2 px-3',
              )}
            >
              <Search className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Search…</span>
                  <kbd className="hidden items-center gap-0.5 rounded border border-rail-border bg-rail-hover px-1.5 py-0.5 font-sans text-xs text-rail-muted sm:inline-flex">
                    ⌘K
                  </kbd>
                </>
              )}
            </button>
          </SidebarTooltip>
        </div>

        {/* Daily-work nav */}
        <nav className={cn('flex-1 space-y-1 p-3', collapsed && 'px-2')}>
          {items.map(({ href, icon: Icon, label }) => {
            const active = href === activeHref
            return (
              <SidebarTooltip key={href} label={label} collapsed={collapsed}>
                <Link href={href} onClick={onNavigate} className={linkClass(active)} aria-label={label} aria-current={active ? 'page' : undefined}>
                  <Icon className={cn('h-4 w-4 flex-shrink-0', active && 'text-brand')} />
                  {!collapsed && <span>{label}</span>}
                </Link>
              </SidebarTooltip>
            )
          })}
        </nav>

        {/* Settings pinned at the bottom — only when the user can reach a section */}
        {showSettings && (
          <div className={cn('mx-3 border-t border-rail-border pb-2 pt-2', collapsed && 'mx-2')}>
            <SidebarTooltip label="Settings" collapsed={collapsed}>
              <Link href="/settings" onClick={onNavigate} className={linkClass(activeHref === '/settings')} aria-label="Settings" aria-current={activeHref === '/settings' ? 'page' : undefined}>
                <Settings className={cn('h-4 w-4 flex-shrink-0', activeHref === '/settings' && 'text-brand')} />
                {!collapsed && <span>Settings</span>}
              </Link>
            </SidebarTooltip>
          </div>
        )}

        {/* User chip → Profile (click yourself), with Sign out */}
        <div className={cn('border-t border-rail-border p-3', collapsed && 'px-2')}>
          <SidebarTooltip label={`${username} · ${roleName}`} collapsed={collapsed}>
            <Link
              href="/profile"
              onClick={onNavigate}
              aria-label="My Profile"
              className={cn(
                'mb-1 rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-rail',
                collapsed ? 'flex h-10 items-center justify-center px-0' : 'block px-3 py-2',
                activeHref === '/profile' ? 'bg-rail-selected text-brand' : 'text-rail-muted hover:bg-rail-hover hover:text-rail-foreground',
              )}
            >
              {collapsed ? (
                <UserRound className="h-4 w-4 text-rail-muted" />
              ) : (
                <>
                  <p className={cn('truncate text-sm font-medium', activeHref === '/profile' ? 'text-brand' : 'text-rail-foreground')}>{username}</p>
                  <p className={cn('text-xs capitalize', activeHref === '/profile' ? 'text-brand/80' : 'text-rail-muted')}>{roleName}</p>
                </>
              )}
            </Link>
          </SidebarTooltip>
          <ThemeToggle collapsed={collapsed} />
          <SidebarTooltip label="Sign out" collapsed={collapsed}>
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              aria-label="Sign out"
              className={cn(
                'text-rail-muted hover:bg-rail-hover hover:text-rail-foreground',
                collapsed ? 'h-10 w-full' : 'w-full justify-start',
              )}
              onClick={onSignOut}
            >
              <LogOut className={cn('h-4 w-4', !collapsed && 'mr-2')} />
              {!collapsed && 'Sign out'}
            </Button>
          </SidebarTooltip>
        </div>

        {onToggleCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="group absolute -right-5 bottom-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-colors group-hover:bg-accent">
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { username, roleName, hasPermission, isSuperadmin, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const ctx = { hasPermission, isSuperadmin }
  const items = mainNav(ctx)
  const showSettings = settingsGroups(ctx).length > 0

  // Redirect away from a section the role can't view (deep links, stale tabs).
  useEffect(() => {
    if (loading) return
    const guard = guardFor(pathname)
    if (!guard) return
    const denied = guard.superadminOnly ? !isSuperadmin : !!guard.permission && !hasPermission(guard.permission)
    if (denied) router.replace('/dashboard')
  }, [loading, pathname, hasPermission, isSuperadmin, router])

  useEffect(() => {
    const id = window.setTimeout(() => {
      const stored = window.localStorage.getItem('chidental-sidebar-collapsed')
      if (stored) setSidebarCollapsed(stored === 'true')
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  // Most specific matching destination wins (so /settings/employees highlights
  // Settings, /profile highlights the chip, etc.).
  const candidates = [...items.map(i => i.href), ...(showSettings ? ['/settings'] : []), '/profile']
  const activeHref = candidates.reduce((best, href) => {
    const matches = pathname === href || pathname.startsWith(`${href}/`)
    return matches && href.length > best.length ? href : best
  }, '')

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  const closeSidebar = () => setSidebarOpen(false)
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev
      window.localStorage.setItem('chidental-sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <div className="flex h-dvh bg-workspace">
      {/* Desktop sidebar */}
      <aside className={cn('hidden flex-shrink-0 flex-col border-r border-rail-border bg-rail transition-[width] duration-200 md:flex', sidebarCollapsed ? 'w-20' : 'w-64')}>
        <SidebarContent
          items={items}
          activeHref={activeHref}
          showSettings={showSettings}
          username={username}
          roleName={roleName}
          onNavigate={closeSidebar}
          onSignOut={handleSignOut}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeSidebar} />
          <aside className="absolute bottom-0 left-0 top-0 z-50 w-[min(18rem,calc(100vw-2rem))] bg-rail shadow-xl">
            <SidebarContent
              items={items}
              activeHref={activeHref}
              showSettings={showSettings}
              username={username}
              roleName={roleName}
              onNavigate={closeSidebar}
              onSignOut={handleSignOut}
              collapsed={false}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Image
            src="/chidental-rectangle.png"
            alt="Chi Dental Lab"
            width={154}
            height={41}
            priority
            className="h-9 w-auto object-contain"
          />
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8">
          {/* App-wide tooltip context so any page (settings managers, etc.) can use
              Tooltip-based controls without each one re-declaring a provider. */}
          <TooltipProvider delayDuration={200}>
            {children}
          </TooltipProvider>
        </main>
      </div>

      <CommandPalette />
    </div>
  )
}

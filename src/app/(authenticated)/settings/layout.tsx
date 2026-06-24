'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { settingsGroups } from '@/domain/navigation'
import { cn } from '@/lib/utils'
import {
  Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem,
} from '@/components/ui/select'

// Two-pane Settings shell: a persistent grouped sub-nav on the left, the routed
// section on the right. The rail is derived from the route registry, so it shows
// exactly the sections the user can reach and never needs hand-maintaining.
//
// On mobile the vertical rail would stack above the content and push it down, so
// below `md` it collapses into a single grouped dropdown switcher fed by the same
// registry — one tap to jump anywhere, no menu to scroll past.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { hasPermission, isSuperadmin, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const groups = settingsGroups({ hasPermission, isSuperadmin })

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const activeHref = groups.flatMap(({ entries }) => entries).find(({ href }) => isActive(href))?.href

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure the lookups, workflow, and access your lab uses.</p>
      </div>

      {/* Mobile: grouped dropdown switcher in place of the rail */}
      {!loading && (
        <div className="md:hidden mb-5">
          <Select value={activeHref ?? ''} onValueChange={(href) => router.push(href)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a section" />
            </SelectTrigger>
            <SelectContent>
              {groups.map(({ group, entries }) => (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {entries.map(({ href, label, icon: Icon }) => (
                    <SelectItem key={href} value={href}>
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sub-nav rail (desktop only) */}
        <nav className="hidden md:block md:w-56 flex-shrink-0 space-y-5">
          {!loading && groups.map(({ group, entries }) => (
            <div key={group}>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-2">{group}</p>
              <div className="space-y-1">
                {entries.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-colors',
                        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Section content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}

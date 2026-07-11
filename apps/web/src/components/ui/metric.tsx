import * as React from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/components/ui/status-pill'

// One metric idiom (see /DESIGN.md §7) — replaces the two tile idioms (KpiCard/StatTile).
// `hero` makes it the single dominant number in a summary zone; the rest are supporting.

const toneText: Record<Tone | 'default', string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-muted-foreground',
}

export interface MetricProps {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  tone?: Tone | 'default'
  hero?: boolean
  className?: string
}

export function Metric({ label, value, hint, icon, tone = 'default', hero = false, className }: MetricProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>
      <span
        className={cn(
          'nums tabular-nums font-semibold leading-tight',
          hero ? 'mt-1.5 text-3xl sm:text-4xl' : 'mt-1 text-xl sm:text-2xl',
          toneText[tone],
        )}
      >
        {value}
      </span>
      {hint && <span className="mt-1 text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

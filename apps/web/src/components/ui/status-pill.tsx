import * as React from 'react'
import { cn } from '@/lib/utils'
import { statusBadgeVariant, type StatusKind } from '@/lib/status-badge'

// The single status-indicator authority (see /DESIGN.md §7). Renders a semantic chip
// with an optional leading dot. For per-lab configurable status colours, pass `dotColor`
// (a raw hex/oklch) — it shows as an accent dot so any admin-chosen colour stays legible
// on the semantic chip, rather than becoming an arbitrary full fill.

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const toneChip: Record<Tone, string> = {
  success: 'bg-success-subtle text-success-subtle-foreground',
  warning: 'bg-warning-subtle text-warning-subtle-foreground',
  danger: 'bg-danger-subtle text-danger-subtle-foreground',
  info: 'bg-info-subtle text-info-subtle-foreground',
  neutral: 'bg-neutral-subtle text-neutral-subtle-foreground',
}

/** The tone chip classes on their own — for controls that can't be a StatusPill
 * span (e.g. a Select trigger or a filter button) but must match its palette. */
export function toneChipClass(tone: Tone): string {
  return toneChip[tone]
}

/** Badge-variant → semantic tone (bridges the existing status-badge mapping). */
export function toneForVariant(v: string): Tone {
  switch (v) {
    case 'success': return 'success'
    case 'warning': return 'warning'
    case 'info': return 'info'
    case 'destructive': return 'danger'
    default: return 'neutral'
  }
}

/** Domain status (payment|work) → semantic tone. */
export function statusTone(kind: StatusKind, value: string): Tone {
  return toneForVariant(statusBadgeVariant(kind, value))
}

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: Tone
  /** Per-lab configurable colour, shown as a leading accent dot. */
  dotColor?: string
  /** Force-show the dot even without a custom colour (uses currentColor). */
  dot?: boolean
}

export function StatusPill({ tone, dotColor, dot, className, children, ...props }: StatusPillProps) {
  const showDot = dot || !!dotColor
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        toneChip[tone],
        className,
      )}
      {...props}
    >
      {showDot && (
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', !dotColor && 'bg-current')}
          style={dotColor ? { backgroundColor: dotColor } : undefined}
        />
      )}
      {children}
    </span>
  )
}

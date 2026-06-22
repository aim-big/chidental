// src/lib/status-badge.ts
import type { BadgeProps } from '@/components/ui/badge'

export type StatusKind = 'payment' | 'work'
export type BadgeVariant = NonNullable<BadgeProps['variant']>

const PAYMENT: Record<string, BadgeVariant> = {
  draft: 'secondary',
  sent: 'info',
  partial: 'warning',
  paid: 'success',
  overdue: 'destructive',
  void: 'destructive',
}

const WORK: Record<string, BadgeVariant> = {
  received: 'secondary',
  in_progress: 'info',
  ready: 'success',
  delivered: 'secondary',
  on_hold: 'warning',
}

/** Canonical domain-status → Badge variant. Unknown values fall back to 'secondary'. */
export function statusBadgeVariant(kind: StatusKind, value: string): BadgeVariant {
  const table = kind === 'payment' ? PAYMENT : WORK
  return table[value] ?? 'secondary'
}

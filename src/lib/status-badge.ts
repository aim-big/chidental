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

// User-facing label overrides. The DB value stays `sent`; the UI says "Issued"
// (matches the Clinic-in-UI / customer-in-code convention). Unmapped values fall
// back to capitalizing the raw status.
const PAYMENT_LABELS: Record<string, string> = {
  sent: 'Issued',
}

/** Human label for a payment status. Use this instead of rendering the raw value. */
export function paymentStatusLabel(value: string): string {
  return PAYMENT_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1)
}

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/components/ui/status-pill'

// One money renderer (see /DESIGN.md §7). Tabular + slashed-zero, MYR "RM", coloured by
// semantic role. Pass a number (formatted here) or a preformatted string via `children`.

const toneText: Record<Tone | 'default', string> = {
  default: '',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-muted-foreground',
}

export function formatMYR(n: number, opts?: { decimals?: boolean }): string {
  const decimals = opts?.decimals ?? true
  return `RM ${n.toLocaleString('en-MY', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`
}

export interface MoneyProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount?: number
  tone?: Tone | 'default'
  decimals?: boolean
}

export function Money({ amount, tone = 'default', decimals, className, children, ...props }: MoneyProps) {
  return (
    <span className={cn('nums tabular-nums', toneText[tone], className)} {...props}>
      {children ?? (amount != null ? formatMYR(amount, { decimals }) : null)}
    </span>
  )
}

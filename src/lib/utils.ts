import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistance } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Today's date as a local `yyyy-MM-dd` string. Unlike
 * `new Date().toISOString().split('T')[0]` this uses the local calendar day,
 * so it doesn't roll to "yesterday/tomorrow" near midnight in UTC+8 (MYT).
 */
export function todayISODate(): string {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

// Relative timestamp for activity feeds, e.g. "5 minutes ago". `now` is injectable
// for deterministic tests; defaults to the current time.
export function formatRelativeTime(date: string | Date, now: Date = new Date()): string {
  return formatDistance(new Date(date), now, { addSuffix: true })
}

// Absolute date + time pinned to Malaysia time (UTC+8), regardless of where the
// code runs (server RSC or any browser). Use for audit/activity timestamps so a
// stored UTC `timestamptz` always reads in the lab's local clock.
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date(date))
}

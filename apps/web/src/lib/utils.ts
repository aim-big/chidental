import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistance } from 'date-fns'

export const LAB_TIME_ZONE = 'Asia/Kuala_Lumpur'

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

/**
 * Short money label for chart axes — "RM950", "RM12k", "RM1.2M". Charts can't
 * afford the full `formatCurrency` width, but every axis should shorten the
 * same way.
 */
export function formatCompactCurrency(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `RM${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `RM${(amount / 1_000).toFixed(0)}k`
  return `RM${amount}`
}

function parseDisplayDate(date: string | Date): Date {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(date)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parseDisplayDate(date))
}

/**
 * A date as a `yyyy-MM-dd` string in the lab's Malaysia calendar.
 */
export function isoDateInTimeZone(date: Date = new Date(), timeZone = LAB_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

/**
 * Today's date as a lab-local `yyyy-MM-dd` string. Unlike
 * `new Date().toISOString().split('T')[0]` this uses the Malaysia calendar day,
 * so it doesn't roll to yesterday/tomorrow near UTC midnight or on UTC hosts.
 */
export function todayISODate(date: Date = new Date()): string {
  return isoDateInTimeZone(date)
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
    timeZone: LAB_TIME_ZONE,
  }).format(new Date(date))
}

// Shared redesign primitives for the /demo pages. One vocabulary — pills, search,
// segmented controls, tables, panels — so every tab reads as one system. Built on
// the app's real tokens (bg-card, border-border, text-muted-foreground, primary…).

import * as React from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '../_lib/mock'
import { rm } from '../_lib/mock'

// ── Surface ──────────────────────────────────────────────────────────────────
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-xl border border-border bg-card shadow-sm', className)}>{children}</div>
}

export function PageHeader({
  title, subtitle, actions,
}: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── Status ───────────────────────────────────────────────────────────────────
const TONE: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-sky-50 text-sky-700',
  brand: 'bg-accent text-accent-foreground',
}
const DOT: Record<Tone, string> = {
  neutral: 'bg-muted-foreground/60', success: 'bg-green-500', warning: 'bg-amber-500',
  danger: 'bg-red-500', info: 'bg-sky-500', brand: 'bg-primary',
}

export function StatusPill({
  tone = 'neutral', dot = false, children, className,
}: {
  tone?: Tone
  dot?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', TONE[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOT[tone])} aria-hidden />}
      {children}
    </span>
  )
}

// ── Search ───────────────────────────────────────────────────────────────────
export function SearchInput({
  value, onChange, placeholder = 'Search…', className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
    </div>
  )
}

// ── Segmented control (tabs / view filters) ──────────────────────────────────
export type SegOption<T extends string> = { value: T; label: string; count?: number }

export function Segmented<T extends string>({
  options, value, onChange, className,
}: {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1', className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-muted text-muted-foreground' : 'text-muted-foreground/70')}>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Data table ───────────────────────────────────────────────────────────────
export type Col<T> = {
  key: string
  header: React.ReactNode
  align?: 'left' | 'right' | 'center'
  cell: (row: T) => React.ReactNode
  className?: string
  headClassName?: string
}

export function DataTable<T>({
  columns, rows, rowKey, onRowClick, empty, footer, rowClassName,
}: {
  columns: Col<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: React.ReactNode
  footer?: React.ReactNode
  rowClassName?: (row: T) => string
}) {
  const alignCls = (a?: 'left' | 'right' | 'center') =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn('whitespace-nowrap px-4 py-2.5 text-xs font-medium text-muted-foreground', alignCls(c.align), c.headClassName)}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16">{empty}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-border/70 last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-muted/40',
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn('whitespace-nowrap px-4 py-3 text-foreground', alignCls(c.align), c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon, title, hint,
}: {
  icon: React.ReactNode
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ── Money + proportion bar + avatar ──────────────────────────────────────────
export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{rm(value)}</span>
}

export function Bar({ value, max, color, className }: { value: number; max: number; color: string; className?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, backgroundColor: color }}
      />
    </div>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.replace(/^Dr\.?\s*/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground', className)}>
      {initials}
    </span>
  )
}

export const BRAND = '#766254'
export const BRAND_SOFT = '#9b8779'
export const SAGE = '#5a8a6f'

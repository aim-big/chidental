'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatRelativeTime, formatDate, formatCurrency } from '@/lib/utils'
import type { TimelineEvent } from '@/data/invoice-activity'

const WORK_STATUS_ACTION = 'work_status.changed'
const SHOW_WS_KEY = 'invoiceActivity.showWorkStatus'

// Actions whose field diffs are worth an expandable list (multi-field edits).
const EXPANDABLE = new Set(['invoice.edited', 'invoice.recipient_changed', 'invoice.case_changed'])

function valueText(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

function money(v: unknown): string {
  return formatCurrency(Number(v ?? 0))
}

function fromTo(c: { from: unknown; to: unknown } | undefined): string {
  if (!c) return ''
  return c.from ? `from ${valueText(c.from)} → ${valueText(c.to)}` : `to ${valueText(c.to)}`
}

// A plain-language predicate that follows the actor's name, built from the
// structured event data so the timeline reads meaningfully.
function describe(e: TimelineEvent): string {
  const m = (e.metadata ?? {}) as Record<string, unknown>
  const c0 = Array.isArray(e.changes) ? e.changes[0] : undefined
  switch (e.action) {
    case 'invoice.created': return `created invoice${m.status ? ` (${m.status})` : ''}`
    case 'invoice.issued': return 'issued invoice'
    case 'payment.recorded': return `recorded payment of ${money(m.amount)}${m.reference_number ? ` · ref ${m.reference_number}` : ''}`
    case 'credit.recorded': return `issued ${money(m.amount)} credit${m.reason ? ` (${m.reason})` : ''}`
    case 'invoice.voided': return 'voided invoice'
    case 'invoice.soft_deleted': return 'deleted invoice'
    case 'invoice.restored': return 'restored invoice'
    case 'invoice.void_restored': return 'restored the voided invoice'
    case 'invoice.purged': return 'permanently deleted invoice'
    case 'invoice.work_note_changed': return `updated work note${m.item ? ` on ${m.item}` : ''}`
    case 'invoice.service_status_changed': return `changed service status ${fromTo(c0)}`.trimEnd()
    case WORK_STATUS_ACTION: return `changed work status${m.item ? ` of ${m.item}` : ''} ${fromTo(c0)}`.trimEnd()
    case 'invoice.case_changed': return 'updated case details'
    case 'invoice.recipient_changed': return 'updated recipient details'
    case 'invoice.edited': {
      const it = m.items as { added?: number; removed?: number } | undefined
      const parts: string[] = []
      if (it?.added) parts.push(`${it.added} item${it.added > 1 ? 's' : ''} added`)
      if (it?.removed) parts.push(`${it.removed} item${it.removed > 1 ? 's' : ''} removed`)
      return `edited the invoice${parts.length ? ` (${parts.join(', ')})` : ''}`
    }
    default: return e.action
  }
}

export function InvoiceActivityPanel({ events }: { events: TimelineEvent[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const [showWorkStatus, setShowWorkStatus] = useState(false)

  // Restore the persisted preference after mount (default stays hidden for SSR).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(SHOW_WS_KEY) === '1') {
      setShowWorkStatus(true)
    }
  }, [])

  function toggleWorkStatus(next: boolean) {
    setShowWorkStatus(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(SHOW_WS_KEY, next ? '1' : '0')
  }

  if (events.length === 0) return null

  const workStatusCount = events.filter(e => e.action === WORK_STATUS_ACTION).length
  const visible = showWorkStatus ? events : events.filter(e => e.action !== WORK_STATUS_ACTION)

  return (
    <Card className="print:hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Activity</CardTitle>
          <p className="text-xs text-muted-foreground">Who did what on this invoice. Internal only — not printed.</p>
        </div>
        {workStatusCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            aria-pressed={showWorkStatus}
            onClick={() => toggleWorkStatus(!showWorkStatus)}
          >
            {showWorkStatus ? 'Hide' : 'Show'} work status ({workStatusCount})
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">
            Only work-status changes so far — toggle “Show work status” to see them.
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map(e => {
              const hasDiff = EXPANDABLE.has(e.action) && Array.isArray(e.changes) && e.changes.length > 0
              return (
                <li key={e.id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm">
                      <span className="font-medium text-foreground">{e.actorName}</span>{' '}
                      <span className="text-muted-foreground">{describe(e)}</span>
                      {e.reason ? <span className="text-muted-foreground"> — {e.reason}</span> : null}
                    </p>
                    <time className="shrink-0 text-xs text-muted-foreground" title={formatDate(e.at)}>
                      {formatRelativeTime(e.at)}
                    </time>
                  </div>
                  {hasDiff && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
                      onClick={() => setOpen(open === e.id ? null : e.id)}
                    >
                      {open === e.id ? 'Hide changes' : `${e.changes!.length} field${e.changes!.length > 1 ? 's' : ''} changed`}
                    </button>
                  )}
                  {hasDiff && open === e.id && (
                    <ul className="mt-2 space-y-1 rounded-md bg-muted/40 p-2 text-xs">
                      {e.changes!.map((c, i) => (
                        <li key={i} className="flex flex-wrap gap-1">
                          <span className="font-medium text-foreground">{c.label}:</span>
                          <span className="text-muted-foreground line-through">{valueText(c.from)}</span>
                          <span aria-hidden>→</span>
                          <span className="text-foreground">{valueText(c.to)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

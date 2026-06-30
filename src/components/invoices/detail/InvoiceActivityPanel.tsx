'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { actionLabel } from '@/lib/audit/action-labels'
import { formatRelativeTime, formatDate } from '@/lib/utils'
import type { TimelineEvent } from '@/data/invoice-activity'

function valueText(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

export function InvoiceActivityPanel({ events }: { events: TimelineEvent[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (events.length === 0) return null

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-base">Activity</CardTitle>
        <p className="text-xs text-muted-foreground">Who did what on this invoice. Internal only — not printed.</p>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {events.map(e => {
            const hasDiff = Array.isArray(e.changes) && e.changes.length > 0
            return (
              <li key={e.id} className="px-4 py-3 sm:px-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium text-foreground">{e.actorName}</span>{' '}
                    <span className="text-muted-foreground">{actionLabel(e.action).toLowerCase()}</span>
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
      </CardContent>
    </Card>
  )
}

'use client'

import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatDate } from '@/lib/utils'
import { matchPreset, PRESET_LABELS, type PresetKind, type PresetMap } from '@/lib/reports-presets'

// The range picker is a single segmented control: the quick presets plus a real,
// clickable "Custom" segment. Selecting Custom reveals the From/To inputs so the
// user understands they're choosing one range, one way or the other.
const SEGMENTS: { key: PresetKind | 'custom'; label: string }[] = [
  ...(Object.keys(PRESET_LABELS) as PresetKind[]).map(key => ({ key, label: PRESET_LABELS[key] })),
  { key: 'custom', label: 'Custom' },
]

// Shared URL-driven date range picker (dashboard + reports). The parent owns
// navigation: `onRangeChange` should push the new range into the URL so the
// server re-queries. `actions` renders on the right of the segment row (e.g.
// the reports Export menu). `isPending` shows the in-flight spinner.
export function DateRangePicker({
  from, to, presets, isPending, onRangeChange, actions,
}: {
  from: string
  to: string
  presets: PresetMap
  isPending: boolean
  onRangeChange: (range: { from: string; to: string }) => void
  actions?: React.ReactNode
}) {
  // The selected segment is derived from the URL, except while the user is
  // composing a custom range (showCustom) before pressing Apply.
  const activeRange = matchPreset(from, to, presets)
  const [showCustom, setShowCustom] = useState(activeRange === 'custom')
  // Draft custom dates: edited locally and committed in one navigation on Apply,
  // so editing both ends costs a single server fetch instead of one per field.
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const selectedSegment = showCustom ? 'custom' : activeRange

  const selectPreset = (kind: PresetKind) => {
    setShowCustom(false)
    onRangeChange(presets[kind])
  }
  const openCustom = () => {
    setDraftFrom(from)
    setDraftTo(to)
    setShowCustom(true)
  }
  const applyCustom = () => onRangeChange({ from: draftFrom, to: draftTo })
  const customUnchanged = draftFrom === from && draftTo === to
  const customInvalid = !draftFrom || !draftTo || draftFrom > draftTo

  // Plain-language summary of the range actually driving the data (the applied
  // from/to, not the in-progress custom draft): the preset name plus the exact
  // dates, so it's never ambiguous what "This month" resolves to.
  const rangeLabel = activeRange === 'custom' ? 'Custom range' : PRESET_LABELS[activeRange]

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-1" role="group" aria-label="Date range">
            {SEGMENTS.map(seg => {
              const isSelected = selectedSegment === seg.key
              return (
                <button
                  key={seg.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => (seg.key === 'custom' ? openCustom() : selectPreset(seg.key))}
                  className={cn(
                    'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {seg.label}
                </button>
              )
            })}
          </div>
          {isPending && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />}
        </div>
        {actions}
      </div>

      {/* Which filter is active + the concrete dates it resolves to */}
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <span>
          Showing <span className="font-medium text-foreground">{rangeLabel}</span>
          {' · '}
          <span className="tabular-nums">{formatDate(from)} – {formatDate(to)}</span>
        </span>
      </p>

      {showCustom && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={draftFrom} max={draftTo || undefined} onChange={e => setDraftFrom(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={draftTo} min={draftFrom || undefined} onChange={e => setDraftTo(e.target.value)} className="w-full sm:w-40" />
          </div>
          <Button onClick={applyCustom} disabled={isPending || customInvalid || customUnchanged} className="w-full sm:w-auto">
            Apply
          </Button>
        </div>
      )}
    </div>
  )
}

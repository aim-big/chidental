// Pure date-range preset math for the Sales Reports page. No React/DOM so it
// stays unit-testable. Presets use the lab's Malaysia calendar, independent of
// the server or browser timezone, so "This month" cannot drift around midnight.

export type PresetKind = 'month' | 'lastMonth' | 'quarter' | 'ytd'
export type DateRange = { from: string; to: string }
export type PresetMap = Record<PresetKind, DateRange>

const LAB_TIME_ZONE = 'Asia/Kuala_Lumpur'
const pad2 = (n: number): string => String(n).padStart(2, '0')
const iso = (year: number, month: number, day: number): string => `${year}-${pad2(month)}-${pad2(day)}`
const endOfMonthDay = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate()

function labDateParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LAB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: 'year' | 'month' | 'day') => Number(parts.find((part) => part.type === type)?.value)
  return { year: value('year'), month: value('month'), day: value('day') }
}

// Display order matters: Object.keys() preserves insertion order, and the
// client renders buttons in that order.
export const PRESET_LABELS: Record<PresetKind, string> = {
  month: 'This month',
  lastMonth: 'Last month',
  quarter: 'This quarter',
  ytd: 'Year to date',
}

export function presetRange(kind: PresetKind, now: Date): DateRange {
  const today = labDateParts(now)
  switch (kind) {
    case 'month':
      return {
        from: iso(today.year, today.month, 1),
        to: iso(today.year, today.month, endOfMonthDay(today.year, today.month)),
      }
    case 'lastMonth': {
      const month = today.month === 1 ? 12 : today.month - 1
      const year = today.month === 1 ? today.year - 1 : today.year
      return {
        from: iso(year, month, 1),
        to: iso(year, month, endOfMonthDay(year, month)),
      }
    }
    case 'quarter': {
      const startMonth = Math.floor((today.month - 1) / 3) * 3 + 1
      const endMonth = startMonth + 2
      return {
        from: iso(today.year, startMonth, 1),
        to: iso(today.year, endMonth, endOfMonthDay(today.year, endMonth)),
      }
    }
    case 'ytd':
      return { from: iso(today.year, 1, 1), to: iso(today.year, today.month, today.day) }
  }
}

export function buildPresets(now: Date): PresetMap {
  return {
    month: presetRange('month', now),
    lastMonth: presetRange('lastMonth', now),
    quarter: presetRange('quarter', now),
    ytd: presetRange('ytd', now),
  }
}

// The preset whose range exactly equals {from,to}, or 'custom' if none match.
export function matchPreset(from: string, to: string, presets: PresetMap): PresetKind | 'custom' {
  for (const kind of Object.keys(presets) as PresetKind[]) {
    if (presets[kind].from === from && presets[kind].to === to) return kind
  }
  return 'custom'
}

function isISODate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  )
}

export function resolveDateRange(
  params: { from?: string; to?: string },
  now: Date,
): DateRange {
  const fallback = presetRange('month', now)
  const hasFrom = params.from != null && params.from !== ''
  const hasTo = params.to != null && params.to !== ''

  if ((hasFrom && !isISODate(params.from)) || (hasTo && !isISODate(params.to))) {
    return fallback
  }

  const from = hasFrom ? params.from! : fallback.from
  const to = hasTo ? params.to! : fallback.to

  return from <= to ? { from, to } : fallback
}

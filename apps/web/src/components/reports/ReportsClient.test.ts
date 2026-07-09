import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ReportsClient } from './ReportsClient'
import type { ReportSummary } from '@/lib/reports'
import type { PresetMap } from '@/lib/reports-presets'
import { TooltipProvider } from '@/components/ui/tooltip'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const summary: ReportSummary = {
  totalInvoiced: 0,
  totalOutstanding: 0,
  invoiceCount: 0,
  outstanding: [],
  agingBuckets: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 },
  sales: [],
  byProduct: [],
  salesSummary: [],
}

const presets: PresetMap = {
  month: { from: '2026-06-01', to: '2026-06-30' },
  lastMonth: { from: '2026-05-01', to: '2026-05-31' },
  quarter: { from: '2026-04-01', to: '2026-06-30' },
  ytd: { from: '2026-01-01', to: '2026-06-15' },
}

describe('ReportsClient metric cards', () => {
  it('labels each card with the detail view it opens', () => {
    const html = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(ReportsClient, {
          from: '2026-06-01',
          to: '2026-06-30',
          summary,
          presets,
          payments: [],
        }),
      ),
    )

    expect(html).toContain('Click to see all invoices behind this number')
    expect(html).toContain('Click to see payments behind this number')
    expect(html).toContain('Click to see outstanding invoices behind this number')
  })
})

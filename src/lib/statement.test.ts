import { describe, it, expect } from 'vitest'
import { buildStatement, buildActivityStatement } from './statement'
import type {
  StatementInvoiceRow,
  StatementPaymentRow,
  StatementCreditRow,
  ActivityPaymentRow,
} from './statement'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TODAY = '2026-06-23'

function makeInv(overrides: Partial<StatementInvoiceRow> & { id: string }): StatementInvoiceRow {
  return {
    invoice_number: `INV-${overrides.id}`,
    invoice_date: '2026-01-01',
    due_date: '2026-01-31',
    patient: null,
    total: 100,
    status: 'sent',
    voided_at: null,
    ...overrides,
  }
}

function makePay(invoice_id: string, amount: number): StatementPaymentRow {
  return { invoice_id, amount }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildStatement', () => {
  it('returns empty statement when no invoices', () => {
    const stmt = buildStatement([], [], [], TODAY)
    expect(stmt.lines).toHaveLength(0)
    expect(stmt.totalBilled).toBe(0)
    expect(stmt.totalPaid).toBe(0)
    expect(stmt.balance).toBe(0)
    expect(stmt.aging.total).toBe(0)
  })

  it('excludes voided invoices from lines, totals, and aging', () => {
    const invoices = [
      makeInv({ id: 'a', total: 200, voided_at: '2026-06-01' }),
      makeInv({ id: 'b', total: 100 }),
    ]
    const stmt = buildStatement(invoices, [], [], TODAY)
    expect(stmt.lines).toHaveLength(1)
    expect(stmt.lines[0].number).toBe('INV-b')
    expect(stmt.totalBilled).toBe(100)
    expect(stmt.totalPaid).toBe(0)
    expect(stmt.balance).toBe(100)
  })

  it('excludes fully-paid invoices from open lines but includes totals', () => {
    const invoices = [
      makeInv({ id: 'a', total: 100 }),
      makeInv({ id: 'b', total: 200 }),
    ]
    const payments = [
      makePay('a', 100), // fully paid
    ]
    const stmt = buildStatement(invoices, payments, [], TODAY)
    expect(stmt.lines).toHaveLength(1)
    expect(stmt.lines[0].number).toBe('INV-b')
    expect(stmt.totalBilled).toBe(300)
    expect(stmt.totalPaid).toBe(100)
    expect(stmt.balance).toBe(200)
  })

  it('sums multiple payments per invoice', () => {
    const invoices = [makeInv({ id: 'a', total: 300 })]
    const payments = [makePay('a', 100), makePay('a', 50)]
    const stmt = buildStatement(invoices, payments, [], TODAY)
    expect(stmt.lines[0].paid).toBe(150)
    expect(stmt.lines[0].balance).toBe(150)
  })

  it('excludes invoice with balance <= 0.005 (rounding threshold)', () => {
    const invoices = [makeInv({ id: 'a', total: 100 })]
    const payments = [makePay('a', 99.996)] // balance = 0.004
    const stmt = buildStatement(invoices, payments, [], TODAY)
    expect(stmt.lines).toHaveLength(0)
    expect(stmt.totalBilled).toBe(100)
    expect(stmt.balance).toBeCloseTo(0.004)
  })

  it('excludes future-dated invoices, payments, and credits from the as-at-today statement', () => {
    const invoices = [
      makeInv({ id: 'current', invoice_date: '2026-06-01', due_date: '2026-06-15', total: 300 }),
      makeInv({ id: 'future', invoice_date: '2026-06-24', due_date: '2026-07-24', total: 900 }),
    ]
    const payments: ActivityPaymentRow[] = [
      { invoice_id: 'current', amount: 100, payment_date: '2026-06-20' },
      { invoice_id: 'current', amount: 50, payment_date: '2026-06-24' },
      { invoice_id: 'future', amount: 900, payment_date: '2026-06-24' },
    ]
    const credits = [
      { credit_date: '2026-06-22', amount: 25, reason: 'goodwill', invoice_id: null },
      { credit_date: '2026-06-24', amount: 75, reason: 'remake', invoice_id: 'current' },
    ]

    const stmt = buildStatement(invoices, payments, credits, TODAY)

    expect(stmt.lines.map((line) => line.number)).toEqual(['INV-current'])
    expect(stmt.totalBilled).toBe(300)
    expect(stmt.totalPaid).toBe(100)
    expect(stmt.totalCredits).toBe(25)
    expect(stmt.balance).toBe(175)
    expect(stmt.aging.total).toBe(200)
    expect(stmt.credits.map((credit) => credit.amount)).toEqual([25])
  })

  it('sorts open lines by invoice_date ascending', () => {
    const invoices = [
      makeInv({ id: 'c', invoice_date: '2026-03-01' }),
      makeInv({ id: 'a', invoice_date: '2026-01-01' }),
      makeInv({ id: 'b', invoice_date: '2026-02-01' }),
    ]
    const stmt = buildStatement(invoices, [], [], TODAY)
    expect(stmt.lines.map(l => l.number)).toEqual(['INV-a', 'INV-b', 'INV-c'])
  })

  describe('aging buckets', () => {
    // TODAY = '2026-06-23'
    // due_date diff from today determines bucket:
    //   <= 0 days overdue → current
    //   1–30  → d1_30
    //   31–60 → d31_60
    //   61–90 → d61_90
    //   90+   → d90plus

    it('buckets not-yet-due balance as current', () => {
      const invoices = [makeInv({ id: 'a', total: 100, due_date: '2026-07-01' })]
      const stmt = buildStatement(invoices, [], [], TODAY)
      expect(stmt.aging.current).toBe(100)
      expect(stmt.aging.total).toBe(100)
    })

    it('buckets due today as current', () => {
      const invoices = [makeInv({ id: 'a', total: 100, due_date: TODAY })]
      const stmt = buildStatement(invoices, [], [], TODAY)
      expect(stmt.aging.current).toBe(100)
    })

    it('buckets 15 days overdue into d1_30', () => {
      // due 2026-06-08 → 15 days overdue
      const invoices = [makeInv({ id: 'a', total: 100, due_date: '2026-06-08' })]
      const stmt = buildStatement(invoices, [], [], TODAY)
      expect(stmt.aging.d1_30).toBe(100)
    })

    it('buckets 45 days overdue into d31_60', () => {
      // due 2026-05-09 → 45 days overdue
      const invoices = [makeInv({ id: 'a', total: 100, due_date: '2026-05-09' })]
      const stmt = buildStatement(invoices, [], [], TODAY)
      expect(stmt.aging.d31_60).toBe(100)
    })

    it('buckets 75 days overdue into d61_90', () => {
      // due 2026-04-09 → 75 days overdue
      const invoices = [makeInv({ id: 'a', total: 100, due_date: '2026-04-09' })]
      const stmt = buildStatement(invoices, [], [], TODAY)
      expect(stmt.aging.d61_90).toBe(100)
    })

    it('buckets 100 days overdue into d90plus', () => {
      // due 2026-03-15 → 100 days overdue
      const invoices = [makeInv({ id: 'a', total: 100, due_date: '2026-03-15' })]
      const stmt = buildStatement(invoices, [], [], TODAY)
      expect(stmt.aging.d90plus).toBe(100)
    })

    it('buckets missing due_date as current', () => {
      const invoices = [makeInv({ id: 'a', total: 100, due_date: null })]
      const stmt = buildStatement(invoices, [], [], TODAY)
      expect(stmt.aging.current).toBe(100)
    })

    it('aging total equals statement balance (open balances only)', () => {
      const invoices = [
        makeInv({ id: 'a', total: 200, due_date: '2026-05-01' }), // overdue
        makeInv({ id: 'b', total: 100, due_date: '2026-07-01' }), // current
        makeInv({ id: 'c', total: 50, voided_at: '2026-01-01' }), // voided — excluded
      ]
      const payments = [makePay('a', 50)] // partial
      const stmt = buildStatement(invoices, payments, [], TODAY)
      // open balances: a=150, b=100
      expect(stmt.aging.total).toBe(250)
      expect(stmt.aging.total).toBe(stmt.balance - 0) // balance = totalBilled(300) - totalPaid(50) = 250
    })

    it('buckets BALANCE (not total) into aging for partially-paid invoice', () => {
      const invoices = [makeInv({ id: 'a', total: 200, due_date: '2026-06-08' })] // 15 days overdue
      const payments = [makePay('a', 60)]
      const stmt = buildStatement(invoices, payments, [], TODAY)
      expect(stmt.aging.d1_30).toBe(140) // balance, not 200
      expect(stmt.aging.total).toBe(140)
    })
  })
})

describe('buildStatement — draft exclusion', () => {
  it('excludes draft (not-yet-issued) invoices from lines, totals, and aging', () => {
    const stmt = buildStatement(
      [makeInv({ id: 'd', total: 800, status: 'draft' }), makeInv({ id: 's', total: 200, status: 'sent' })],
      [],
      [],
      TODAY,
    )
    expect(stmt.lines).toHaveLength(1)
    expect(stmt.lines[0].number).toBe('INV-s')
    expect(stmt.totalBilled).toBe(200)
    expect(stmt.balance).toBe(200)
    expect(stmt.aging.total).toBe(200)
  })
})

describe('buildStatement — credits', () => {
  function makeCredit(overrides: Partial<StatementCreditRow> = {}): StatementCreditRow {
    return { credit_date: '2026-02-01', amount: 50, reason: 'goodwill', invoice_id: null, ...overrides }
  }

  it('reduces the closing balance by the sum of active credits', () => {
    const invoices = [makeInv({ id: 'a', total: 300 })]
    const credits = [makeCredit({ amount: 120, reason: 'remake' })]
    const stmt = buildStatement(invoices, [], credits, TODAY)
    expect(stmt.totalBilled).toBe(300)
    expect(stmt.totalPaid).toBe(0)
    expect(stmt.totalCredits).toBe(120)
    // closing balance = billed(300) − paid(0) − credits(120)
    expect(stmt.balance).toBe(180)
  })

  it('credits do NOT enter the payment-based aging buckets', () => {
    // Aging stays payment-based: it buckets the full open balance of the
    // invoice, unaffected by the credit, which lands only in totalCredits.
    const invoices = [makeInv({ id: 'a', total: 200, due_date: '2026-06-08' })] // 15 days overdue
    const credits = [makeCredit({ amount: 80 })]
    const stmt = buildStatement(invoices, [], credits, TODAY)
    expect(stmt.aging.d1_30).toBe(200)
    expect(stmt.aging.total).toBe(200)
    expect(stmt.totalCredits).toBe(80)
    expect(stmt.balance).toBe(120) // 200 − 80
  })

  it('emits dated credit ledger lines sorted by credit_date ascending', () => {
    const invoices = [makeInv({ id: 'a', total: 500 })]
    const credits = [
      makeCredit({ credit_date: '2026-03-15', amount: 30, reason: 'return' }),
      makeCredit({ credit_date: '2026-01-10', amount: 20, reason: 'goodwill' }),
    ]
    const stmt = buildStatement(invoices, [], credits, TODAY)
    expect(stmt.credits.map((c) => c.date)).toEqual(['2026-01-10', '2026-03-15'])
    expect(stmt.credits[0].reason).toBe('goodwill')
    expect(stmt.totalCredits).toBe(50)
  })

  it('carries the invoice number for an invoice-linked credit, null for a clinic-level credit', () => {
    const invoices = [makeInv({ id: 'a', invoice_number: 'INV-2026-001', total: 400 })]
    const credits = [
      makeCredit({ amount: 60, invoice_id: 'a' }), // linked
      makeCredit({ amount: 40, invoice_id: null }), // clinic-level
    ]
    const stmt = buildStatement(invoices, [], credits, TODAY)
    const linked = stmt.credits.find((c) => c.amount === 60)
    const clinic = stmt.credits.find((c) => c.amount === 40)
    expect(linked?.number).toBe('INV-2026-001')
    expect(clinic?.number).toBeNull()
  })

  it('no credits → empty credit lines, zero totalCredits, balance unchanged', () => {
    const invoices = [makeInv({ id: 'a', total: 100 })]
    const stmt = buildStatement(invoices, [], [], TODAY)
    expect(stmt.credits).toHaveLength(0)
    expect(stmt.totalCredits).toBe(0)
    expect(stmt.balance).toBe(100)
  })
})

// ── Activity statement (period ledger) ────────────────────────────────────────

describe('buildActivityStatement', () => {
  function makeActPay(
    invoice_id: string,
    amount: number,
    payment_date: string,
    reference_number: string | null = null,
  ): ActivityPaymentRow {
    return { invoice_id, amount, payment_date, reference_number }
  }

  function makeCredit(overrides: Partial<StatementCreditRow> = {}): StatementCreditRow {
    return { credit_date: '2026-06-01', amount: 50, reason: 'goodwill', invoice_id: null, ...overrides }
  }

  const FROM = '2026-06-01'
  const TO = '2026-06-30'

  it('returns an empty statement for no data', () => {
    const stmt = buildActivityStatement([], [], [], FROM, TO)
    expect(stmt.openingBalance).toBe(0)
    expect(stmt.lines).toHaveLength(0)
    expect(stmt.totalInvoiced).toBe(0)
    expect(stmt.totalPayments).toBe(0)
    expect(stmt.totalCredits).toBe(0)
    expect(stmt.closingBalance).toBe(0)
  })

  it('folds pre-period invoices, payments, and credits into the opening balance', () => {
    const invoices = [
      makeInv({ id: 'old', invoice_date: '2026-05-10', total: 1000 }),
      makeInv({ id: 'cur', invoice_date: '2026-06-15', total: 300 }),
    ]
    const payments = [makeActPay('old', 400, '2026-05-20')]
    const credits = [makeCredit({ credit_date: '2026-05-25', amount: 100 })]
    const stmt = buildActivityStatement(invoices, payments, credits, FROM, TO)
    // opening = 1000 − 400 − 100
    expect(stmt.openingBalance).toBe(500)
    // only the June invoice is a ledger line
    expect(stmt.lines).toHaveLength(1)
    expect(stmt.lines[0].number).toBe('INV-cur')
    expect(stmt.closingBalance).toBe(800)
  })

  it('builds a chronological ledger with a correct running balance', () => {
    const invoices = [
      makeInv({ id: 'a', invoice_number: 'INV-A', invoice_date: '2026-06-05', total: 1200, patient: 'Ali' }),
      makeInv({ id: 'b', invoice_number: 'INV-B', invoice_date: '2026-06-20', total: 800 }),
    ]
    const payments = [makeActPay('a', 1200, '2026-06-10', 'BANKREF1')]
    const credits = [makeCredit({ credit_date: '2026-06-25', amount: 150, reason: 'remake', invoice_id: 'b' })]
    const stmt = buildActivityStatement(invoices, payments, credits, FROM, TO)

    expect(stmt.openingBalance).toBe(0)
    expect(stmt.lines.map((l) => l.kind)).toEqual(['invoice', 'payment', 'invoice', 'credit'])
    expect(stmt.lines.map((l) => l.balance)).toEqual([1200, 0, 800, 650])

    const [invA, payA, , credB] = stmt.lines
    expect(invA.debit).toBe(1200)
    expect(invA.credit).toBe(0)
    expect(invA.patient).toBe('Ali')
    expect(payA.credit).toBe(1200)
    expect(payA.number).toBe('INV-A') // payment carries the invoice it settles
    expect(payA.reference).toBe('BANKREF1')
    expect(credB.credit).toBe(150)
    expect(credB.number).toBe('INV-B') // linked credit carries its invoice number
    expect(credB.reason).toBe('remake')

    expect(stmt.totalInvoiced).toBe(2000)
    expect(stmt.totalPayments).toBe(1200)
    expect(stmt.totalCredits).toBe(150)
    expect(stmt.closingBalance).toBe(650)
    // ledger identity: closing = opening + invoiced − payments − credits
    expect(stmt.closingBalance).toBe(
      stmt.openingBalance + stmt.totalInvoiced - stmt.totalPayments - stmt.totalCredits,
    )
  })

  it('orders same-day activity as invoice → payment → credit', () => {
    const d = '2026-06-15'
    const invoices = [makeInv({ id: 'a', invoice_date: d, total: 500 })]
    const payments = [makeActPay('a', 500, d)]
    const credits = [makeCredit({ credit_date: d, amount: 20 })]
    const stmt = buildActivityStatement(invoices, payments, credits, FROM, TO)
    expect(stmt.lines.map((l) => l.kind)).toEqual(['invoice', 'payment', 'credit'])
    expect(stmt.lines.map((l) => l.balance)).toEqual([500, 0, -20])
  })

  it('excludes voided and draft invoices AND their payments everywhere', () => {
    const invoices = [
      makeInv({ id: 'v', invoice_date: '2026-05-01', total: 900, voided_at: '2026-05-02' }),
      makeInv({ id: 'd', invoice_date: '2026-06-10', total: 700, status: 'draft' }),
      makeInv({ id: 'ok', invoice_date: '2026-06-12', total: 100 }),
    ]
    const payments = [
      makeActPay('v', 900, '2026-05-03'), // payment on voided invoice — ignored
      makeActPay('d', 200, '2026-06-11'), // payment on draft — ignored
    ]
    const stmt = buildActivityStatement(invoices, payments, [], FROM, TO)
    expect(stmt.openingBalance).toBe(0)
    expect(stmt.lines).toHaveLength(1)
    expect(stmt.lines[0].number).toBe('INV-ok')
    expect(stmt.closingBalance).toBe(100)
  })

  it('includes lines dated exactly on the from/to boundaries, excludes after to', () => {
    const invoices = [
      makeInv({ id: 'onFrom', invoice_date: FROM, total: 10 }),
      makeInv({ id: 'onTo', invoice_date: TO, total: 20 }),
      makeInv({ id: 'after', invoice_date: '2026-07-01', total: 40 }),
      makeInv({ id: 'before', invoice_date: '2026-05-31', total: 80 }),
    ]
    const stmt = buildActivityStatement(invoices, [], [], FROM, TO)
    expect(stmt.lines.map((l) => l.number)).toEqual(['INV-onFrom', 'INV-onTo'])
    expect(stmt.openingBalance).toBe(80) // 'before' folds into opening
    expect(stmt.closingBalance).toBe(110) // 80 + 10 + 20; 'after' fully excluded
    expect(stmt.totalInvoiced).toBe(30)
  })

  it('clinic-level credit line carries a null invoice number', () => {
    const stmt = buildActivityStatement(
      [makeInv({ id: 'a', invoice_date: '2026-06-02', total: 100 })],
      [],
      [makeCredit({ credit_date: '2026-06-03', amount: 30, invoice_id: null })],
      FROM,
      TO,
    )
    const cred = stmt.lines.find((l) => l.kind === 'credit')
    expect(cred?.number).toBeNull()
    expect(stmt.closingBalance).toBe(70)
  })

  it('sums multiple partial payments against one invoice as separate ledger lines', () => {
    const invoices = [makeInv({ id: 'a', invoice_date: '2026-06-01', total: 300 })]
    const payments = [
      makeActPay('a', 100, '2026-06-10', 'R1'),
      makeActPay('a', 50, '2026-06-20', 'R2'),
    ]
    const stmt = buildActivityStatement(invoices, payments, [], FROM, TO)
    expect(stmt.lines.filter((l) => l.kind === 'payment')).toHaveLength(2)
    expect(stmt.totalPayments).toBe(150)
    expect(stmt.closingBalance).toBe(150)
    expect(stmt.lines.map((l) => l.balance)).toEqual([300, 200, 150])
  })

  it('full-history closing balance equals the open-item statement balance', () => {
    // The two builders must agree on the account balance — this is the
    // "numbers are correct" cross-check.
    const invoices = [
      makeInv({ id: 'a', invoice_date: '2026-01-05', total: 300 }),
      makeInv({ id: 'b', invoice_date: '2026-03-10', total: 200 }),
      makeInv({ id: 'v', invoice_date: '2026-02-01', total: 100, voided_at: '2026-02-02' }),
      makeInv({ id: 'd', invoice_date: '2026-04-01', total: 500, status: 'draft' }),
    ]
    const payments = [
      makeActPay('a', 100, '2026-02-15'),
      makeActPay('b', 50, '2026-04-20'),
      makeActPay('v', 100, '2026-02-03'), // voided invoice — both builders must ignore
    ]
    const credits = [
      makeCredit({ credit_date: '2026-05-01', amount: 40 }),
      makeCredit({ credit_date: '2026-05-02', amount: 25, invoice_id: 'a' }),
    ]
    const open = buildStatement(invoices, payments, credits, TODAY)
    const activity = buildActivityStatement(invoices, payments, credits, '2000-01-01', TODAY)
    expect(activity.openingBalance).toBe(0)
    expect(activity.closingBalance).toBe(open.balance) // 500 − 150 − 65 = 285
    expect(activity.closingBalance).toBe(285)
  })
})

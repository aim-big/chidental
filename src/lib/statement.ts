/**
 * Pure helper for building an open-item Statement of Account.
 *
 * No database calls — accepts raw rows and returns a derived statement
 * object suitable for rendering or testing.
 */

import { differenceInCalendarDays } from 'date-fns'
import type { ArAging } from './invoice-status'

// ── Input types ──────────────────────────────────────────────────────────────

export type StatementInvoiceRow = {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string | null
  patient: string | null
  total: number
  status: string
  voided_at: string | null
}

export type StatementPaymentRow = {
  invoice_id: string
  amount: number
  payment_date?: string | null
}

// Payment row for the activity (period-ledger) statement — needs the date to
// place the payment on the ledger and the bank reference for display.
export type ActivityPaymentRow = StatementPaymentRow & {
  payment_date: string
  reference_number?: string | null
}

export type StatementCreditRow = {
  credit_date: string
  amount: number
  reason: string
  // Optional invoice link — a credit may be clinic-level (null) or against a
  // specific invoice. The statement shows the invoice number when present.
  invoice_id?: string | null
}

// ── Output types ─────────────────────────────────────────────────────────────

export type StatementLine = {
  date: string
  number: string
  patient: string | null
  total: number
  paid: number
  balance: number
}

// A dated credit ledger line ("Credit — {reason}"). It reduces the running
// account balance. `number` carries the linked invoice number when the credit
// is invoice-scoped, else null (clinic-level credit).
export type StatementCreditLine = {
  date: string
  reason: string
  number: string | null
  amount: number
}

export type Statement = {
  lines: StatementLine[]
  credits: StatementCreditLine[]
  totalBilled: number
  totalPaid: number
  // Sum of account credits dated on or before the statement date.
  totalCredits: number
  // Closing account balance = totalBilled − totalPaid − totalCredits.
  balance: number
  aging: ArAging
}

// One ledger row of the activity statement. Exactly one of debit/credit is
// non-zero; `balance` is the running account balance AFTER this line.
export type ActivityLine = {
  date: string
  kind: 'invoice' | 'payment' | 'credit'
  // Related invoice number: the invoice itself, the invoice a payment settles,
  // or the invoice a credit is linked to (null for clinic-level credits).
  number: string | null
  patient: string | null // invoice lines only
  reference: string | null // payment lines only (bank reference)
  reason: string | null // credit lines only
  debit: number
  credit: number
  balance: number
}

export type ActivityStatement = {
  // Account balance carried into the period: all issued activity dated < from.
  openingBalance: number
  lines: ActivityLine[]
  // Period totals (activity dated within [from, to]).
  totalInvoiced: number
  totalPayments: number
  totalCredits: number
  // openingBalance + totalInvoiced − totalPayments − totalCredits.
  closingBalance: number
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Build an open-item statement.
 *
 * - Voided and draft (not-yet-issued) invoices are excluded entirely — a
 *   statement of account shows issued billing activity only.
 * - Per-invoice `paid` is the sum of all matching payment rows.
 * - Only invoices with `balance > 0.005` appear in the open-item table,
 *   sorted by `invoice_date` ascending.
 * - `totalBilled` / `totalPaid` are across issued, non-voided invoices dated
 *   on or before `today`.
 * - Aging buckets each open line's BALANCE (not total) by days past `due_date`
 *   using the same boundaries as `arAging` in `invoice-status.ts`.
 *   Missing `due_date` → current bucket.
 * - Credits (remake / return / goodwill) are a non-payment reduction of the
 *   clinic's account. They are NOT folded into the open-item lines or the
 *   payment-based aging buckets; instead they surface as their own dated ledger
 *   lines (sorted by `credit_date`) and net the closing `balance` down via
 *   `totalCredits`. A credit may be clinic-level (no `invoice_id`) or linked to
 *   a specific invoice (its number is carried through for display).
 *
 * @param invoices  Non-mutated; voided rows are skipped internally.
 * @param payments  All payment rows for the clinic's invoices.
 * @param credits   Account credits for the clinic; future-dated credits are skipped.
 * @param today     Local `yyyy-MM-dd` string (from `todayISODate()`).
 */
export function buildStatement(
  invoices: StatementInvoiceRow[],
  payments: StatementPaymentRow[],
  credits: StatementCreditRow[],
  today: string,
): Statement {
  // Sum payments per invoice
  const paidByInvoice = new Map<string, number>()
  for (const p of payments) {
    if (p.payment_date != null && p.payment_date !== '' && p.payment_date > today) continue
    paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount))
  }

  // Map invoice id → number so an invoice-linked credit can display its number.
  const numberByInvoice = new Map<string, string>()
  for (const inv of invoices) numberByInvoice.set(inv.id, inv.invoice_number)

  let totalBilled = 0
  let totalPaid = 0
  const lines: StatementLine[] = []
  const aging: ArAging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 }

  for (const inv of invoices) {
    // A statement shows ISSUED activity only — skip voided and not-yet-issued drafts.
    if (inv.voided_at != null || inv.status === 'draft') continue
    // The open-item view is an as-at-today statement; future-dated charges do
    // not exist in the account yet, even if they have been entered ahead of time.
    if (inv.invoice_date > today) continue

    const total = Number(inv.total)
    const paid = paidByInvoice.get(inv.id) ?? 0
    const balance = total - paid

    totalBilled += total
    totalPaid += paid

    if (balance <= 0.005) continue

    lines.push({
      date: inv.invoice_date,
      number: inv.invoice_number,
      patient: inv.patient,
      total,
      paid,
      balance,
    })

    // Bucket this line's balance into aging
    aging.total += balance
    if (inv.due_date == null || inv.due_date === '') {
      aging.current += balance
    } else {
      const days = differenceInCalendarDays(new Date(today), new Date(inv.due_date))
      if (days <= 0) aging.current += balance
      else if (days <= 30) aging.d1_30 += balance
      else if (days <= 60) aging.d31_60 += balance
      else if (days <= 90) aging.d61_90 += balance
      else aging.d90plus += balance
    }
  }

  // Sort open lines by invoice_date ascending
  lines.sort((a, b) => a.date.localeCompare(b.date))

  // Build credit ledger lines (dated, oldest-first). Each reduces the closing
  // balance. An invoice-linked credit carries its invoice number for display.
  let totalCredits = 0
  const creditLines: StatementCreditLine[] = credits
    .filter((c) => c.credit_date <= today)
    .map((c) => {
      const amount = Number(c.amount)
      totalCredits += amount
      return {
        date: c.credit_date,
        reason: c.reason,
        number: c.invoice_id ? numberByInvoice.get(c.invoice_id) ?? null : null,
        amount,
      }
    })
  creditLines.sort((a, b) => a.date.localeCompare(b.date))

  return {
    lines,
    credits: creditLines,
    totalBilled,
    totalPaid,
    totalCredits,
    // Closing account balance nets out credits — they are an explicit, legible
    // reduction, not folded into the payment-based open-item totals or aging.
    balance: totalBilled - totalPaid - totalCredits,
    aging,
  }
}

/**
 * Build an activity statement: a chronological transaction ledger for the
 * period [from, to] (inclusive, `yyyy-MM-dd` strings), with the account
 * balance brought forward from everything dated before `from`.
 *
 * - Same inclusion rule as `buildStatement`: voided and draft invoices are
 *   excluded, AND so are their payments — both from the opening balance and
 *   the ledger — so the two builders always agree on the account balance.
 * - Ledger order: date ascending; same-day ties render invoice → payment →
 *   credit (a same-day payment settles the invoice above it).
 * - Invariant: closingBalance = openingBalance + totalInvoiced −
 *   totalPayments − totalCredits, and over a full-history range it equals
 *   `buildStatement(...).balance`.
 */
export function buildActivityStatement(
  invoices: StatementInvoiceRow[],
  payments: ActivityPaymentRow[],
  credits: StatementCreditRow[],
  from: string,
  to: string,
): ActivityStatement {
  // Issued, non-voided invoices only — the single source of truth for what
  // counts as billing activity (mirrors buildStatement).
  const active = invoices.filter((inv) => inv.voided_at == null && inv.status !== 'draft')
  const activeIds = new Set(active.map((inv) => inv.id))
  const numberByInvoice = new Map(active.map((inv) => [inv.id, inv.invoice_number]))
  // Payments on excluded (voided/draft) invoices never count.
  const activePayments = payments.filter((p) => activeIds.has(p.invoice_id))

  const inPeriod = (date: string) => date >= from && date <= to

  let openingBalance = 0
  let totalInvoiced = 0
  let totalPayments = 0
  let totalCredits = 0

  // kind ranks same-day ties: invoice(0) → payment(1) → credit(2).
  const pending: Array<Omit<ActivityLine, 'balance'> & { rank: number }> = []

  for (const inv of active) {
    const total = Number(inv.total)
    if (inv.invoice_date < from) {
      openingBalance += total
    } else if (inPeriod(inv.invoice_date)) {
      totalInvoiced += total
      pending.push({
        date: inv.invoice_date,
        kind: 'invoice',
        number: inv.invoice_number,
        patient: inv.patient,
        reference: null,
        reason: null,
        debit: total,
        credit: 0,
        rank: 0,
      })
    }
  }

  for (const p of activePayments) {
    const amount = Number(p.amount)
    if (p.payment_date < from) {
      openingBalance -= amount
    } else if (inPeriod(p.payment_date)) {
      totalPayments += amount
      pending.push({
        date: p.payment_date,
        kind: 'payment',
        number: numberByInvoice.get(p.invoice_id) ?? null,
        patient: null,
        reference: p.reference_number ?? null,
        reason: null,
        debit: 0,
        credit: amount,
        rank: 1,
      })
    }
  }

  for (const c of credits) {
    const amount = Number(c.amount)
    if (c.credit_date < from) {
      openingBalance -= amount
    } else if (inPeriod(c.credit_date)) {
      totalCredits += amount
      pending.push({
        date: c.credit_date,
        kind: 'credit',
        number: c.invoice_id ? numberByInvoice.get(c.invoice_id) ?? null : null,
        patient: null,
        reference: null,
        reason: c.reason,
        debit: 0,
        credit: amount,
        rank: 2,
      })
    }
  }

  pending.sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank)

  let running = openingBalance
  const lines: ActivityLine[] = pending.map((line) => {
    running += line.debit - line.credit
    return {
      date: line.date,
      kind: line.kind,
      number: line.number,
      patient: line.patient,
      reference: line.reference,
      reason: line.reason,
      debit: line.debit,
      credit: line.credit,
      balance: running,
    }
  })

  return {
    openingBalance,
    lines,
    totalInvoiced,
    totalPayments,
    totalCredits,
    closingBalance: openingBalance + totalInvoiced - totalPayments - totalCredits,
  }
}

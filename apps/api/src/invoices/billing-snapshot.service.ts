import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'

// Defaults mirror apps/web `@/lib/config` DEFAULT_BILLING_SETTINGS (BANK +
// INVOICE_NOTES). The snapshot freezes the lab's current payment details onto an
// invoice when it is issued (draft → sent), so a later settings change doesn't
// rewrite already-issued invoices.
const DEFAULTS = {
  bankName: 'Public Bank',
  accountName: 'Chi Dental Lab Sdn Bhd',
  accountNumber: '3249402703',
  paymentNote: 'Please use invoice number as payment reference',
  invoiceNotes: ['Goods sold are neither returnable nor refundable.'],
}

export interface InvoicePaymentSnapshot {
  payment_bank_name: string
  payment_account_name: string
  payment_account_number: string
  payment_note: string
  invoice_notes: string[]
}

@Injectable()
export class BillingSnapshotService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Mirrors `invoiceSnapshotFromSettings(await getBillingSettings())`:
   * billingSettingsFromRow (row-or-defaults) → normalizeBillingSettings (trim +
   * drop empty notes) → the five snapshot columns.
   */
  async invoiceSnapshot(): Promise<InvoicePaymentSnapshot> {
    const { data: row } = await this.supabase.admin
      .from('lab_billing_settings')
      .select('bank_name, account_name, account_number, payment_note, invoice_notes')
      .eq('id', 'default')
      .maybeSingle()

    // billingSettingsFromRow: `||` for the string bank fields, `??` for
    // payment_note / invoice_notes.
    const bankName = row?.bank_name || DEFAULTS.bankName
    const accountName = row?.account_name || DEFAULTS.accountName
    const accountNumber = row?.account_number || DEFAULTS.accountNumber
    const paymentNote = row?.payment_note ?? DEFAULTS.paymentNote
    const invoiceNotes: string[] = (row?.invoice_notes as string[] | null) ?? DEFAULTS.invoiceNotes

    // normalizeBillingSettings: trim scalars, trim + drop empty notes.
    return {
      payment_bank_name: bankName.trim(),
      payment_account_name: accountName.trim(),
      payment_account_number: accountNumber.trim(),
      payment_note: paymentNote.trim(),
      invoice_notes: invoiceNotes.map((n) => n.trim()).filter(Boolean),
    }
  }
}

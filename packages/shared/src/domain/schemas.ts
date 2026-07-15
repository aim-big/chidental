import { z } from 'zod'

/**
 * Normalize a product unit-of-measure: trim, lowercase, and drop a redundant
 * leading "per " (the UI renders "per {unit}", so the stored value is the bare
 * noun, e.g. "tooth"). Returns "" for blank or bare-"per " input.
 */
export function normalizeUnit(raw: string): string {
  return raw.trim().toLowerCase().replace(/^per(?:\s+|$)/, '').trim()
}

export const lineItemSchema = z.object({
  product_id: z.string().uuid().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
})
export const invoiceInputSchema = z.object({
  customer_id: z.string().uuid(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  patient: z.string().optional(),
  doctor: z.string().optional(),
  items: z.array(lineItemSchema).min(1),
})
export const paymentInputSchema = z.object({
  amount: z.number().positive(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reference: z.string().optional(), // matches the live recordPaymentAction input field
  notes: z.string().optional(),
})
// Wave 6 — account credit / adjustment. A credit is a non-payment reduction of a
// clinic's account (remake / return / goodwill). `invoice_id` is optional: a
// credit may be clinic-level (unlinked) or issued against a specific invoice.
export const creditInputSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  reason: z.enum(['remake', 'return', 'goodwill']),
  invoice_id: z.string().uuid().nullable().optional(),
  credit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
})
export const customerInputSchema = z.object({
  clinic_name: z.string().min(1, 'Clinic name is required'),
  ssm_no: z.string().optional(),
  contact_person: z.string().min(1, 'Contact person is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().min(1, 'Email is required').pipe(z.email('Invalid email')),
  billing_address: z.string().min(1, 'Billing address is required'),
  delivery_address: z.string().min(1, 'Delivery address is required'),
  notes: z.string().optional(),
})
export const productInputSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().nullable(),
    unit_price: z.number().min(0),
    unit: z
      .string()
      .transform(normalizeUnit)
      .refine((v) => v.length > 0, 'Unit is required'),
    min_unit_price: z.number().min(0).nullable(),
    max_unit_price: z.number().min(0).nullable(),
  })
  .refine((p) => p.min_unit_price == null || p.max_unit_price == null || p.min_unit_price <= p.max_unit_price, {
    message: 'min must be <= max',
    path: ['max_unit_price'],
  })

// ── Phase 0: id / primitive guards (defense-in-depth on id + scalar params) ──
export const idSchema = z.string().uuid()
export const nullableIdSchema = z.string().uuid().nullable()

// ── Invoice server-action payloads (accurate to invoice-actions.ts inputs) ──
// These mirror InvoicePayload / InvoiceItemPayload in src/data/invoice-actions.ts
// and become the Nest DTOs in Phase 3. Keep the field lists in sync.
export const invoicePayloadSchema = z.object({
  customer_id: z.string().uuid(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable(),
  patient: z.string().nullable(),
  doctor: z.string().nullable(),
  service_status_id: z.string().uuid().nullable(),
  bill_to_name: z.string().nullable(),
  bill_to_contact: z.string().nullable(),
  bill_to_phone: z.string().nullable(),
  billing_address: z.string().nullable(),
  ship_to_name: z.string().nullable(),
  ship_to_contact: z.string().nullable(),
  delivery_address: z.string().nullable(),
  subtotal: z.number().min(0),
  total: z.number().min(0),
})
export const invoiceItemPayloadSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  product_id: z.string().uuid().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  amount: z.number().min(0),
})
export const createInvoiceInputSchema = z.object({
  p_invoice: invoicePayloadSchema.extend({ status: z.enum(['draft', 'sent']) }),
  p_items: z.array(invoiceItemPayloadSchema).min(1),
})
export const updateInvoiceInputSchema = z.object({
  p_invoice: invoicePayloadSchema,
  p_items: z.array(invoiceItemPayloadSchema).min(1),
})

// Reuse the reconciled paymentInputSchema under the action-scoped name.
export const recordPaymentInputSchema = paymentInputSchema

export const caseDetailsSchema = z.object({
  patient: z.string().nullable(),
  doctor: z.string().nullable(),
})
export const serviceStatusInputSchema = z.object({
  serviceStatusId: z.string().uuid().nullable(),
})
export const recipientFieldsSchema = z.object({
  bill_to_name: z.string().nullable(),
  bill_to_contact: z.string().nullable(),
  bill_to_phone: z.string().nullable(),
  billing_address: z.string().nullable(),
  ship_to_name: z.string().nullable(),
  ship_to_contact: z.string().nullable(),
  delivery_address: z.string().nullable(),
})

// Mirror of the `work_status` DB enum (src/lib/work-status WORK_STATUSES).
export const workStatusInputSchema = z.object({
  work_status: z.enum(['received', 'in_progress', 'ready', 'delivered', 'on_hold']),
  stage_id: z.string().uuid().nullable(),
})
export const workNoteInputSchema = z.object({
  workNote: z.string().nullable(),
})
export const toggleActiveInputSchema = z.object({
  active: z.boolean(),
})

// Port of validateBillingSettings (src/lib/billing-settings.ts): required bank
// fields (after trim) + payment terms >= 1 whole day. Same messages so the error
// text the UI shows is unchanged.
export const billingSettingsInputSchema = z.object({
  bankName: z.string().trim().min(1, 'Bank name is required.'),
  accountName: z.string().trim().min(1, 'Account name is required.'),
  accountNumber: z.string().trim().min(1, 'Account number is required.'),
  paymentNote: z.string(),
  invoiceNotes: z.array(z.string()),
  paymentTermsDays: z.number().refine((n) => Number.isFinite(n) && n >= 1, 'Payment terms must be at least 1 day.'),
})

// Query-param contract for the date-ranged read endpoints (dashboard, reports).
// `from`/`to` are inclusive YYYY-MM-DD calendar dates. Validating here turns a
// missing/malformed range into a 400 at the controller boundary instead of a
// 500 when the date math later hits `new Date(undefined)` (Invalid time value).
export const dateRangeQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
})

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>

export type InvoiceInput = z.infer<typeof invoiceInputSchema>
export type PaymentInput = z.infer<typeof paymentInputSchema>
export type CreditInput = z.infer<typeof creditInputSchema>
export type CustomerInput = z.infer<typeof customerInputSchema>
// Form-side value type: the schema's INPUT shape that react-hook-form binds.
export type CustomerFormInput = z.input<typeof customerInputSchema>
export type ProductInput = z.infer<typeof productInputSchema>

// Port of apps/web `@/lib/audit/diff` + the field-label maps from
// `@/lib/audit/action-labels`, used by the invoice write endpoints to build the
// activity-row `changes`. Kept byte-identical so the audit trail matches whether
// a write ran locally or on the API.

export interface FieldChange {
  field: string
  label: string
  from: unknown
  to: unknown
}

// Normalize so empties (null/undefined/'') compare equal, and numeric strings
// compare by value. Everything else compares by its string form.
function norm(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return String(Number(v))
  return String(v)
}

export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
): FieldChange[] {
  const changes: FieldChange[] = []
  for (const [field, label] of Object.entries(labels)) {
    if (norm(before[field]) !== norm(after[field])) {
      changes.push({ field, label, from: before[field] ?? null, to: after[field] ?? null })
    }
  }
  return changes
}

export const INVOICE_FIELD_LABELS: Record<string, string> = {
  invoice_date: 'Invoice date',
  due_date: 'Due date',
  notes: 'Remarks',
  patient: 'Patient',
  doctor: 'Doctor',
  service_status_id: 'Service status',
  total: 'Total',
  subtotal: 'Subtotal',
}

export const RECIPIENT_FIELD_LABELS: Record<string, string> = {
  bill_to_name: 'Bill-to name',
  bill_to_contact: 'Bill-to contact',
  bill_to_phone: 'Bill-to phone',
  billing_address: 'Billing address',
  ship_to_name: 'Deliver-to name',
  ship_to_contact: 'Deliver-to contact',
  delivery_address: 'Delivery address',
}

// User-facing labels for audit/timeline rows. No i18n system exists, so labels are
// hardcoded; customer-facing terminology says "Clinic" per project convention.

const ACTION_LABELS: Record<string, string> = {
  'invoice.created': 'Created invoice',
  'invoice.issued': 'Issued invoice',
  'invoice.edited': 'Edited invoice',
  'invoice.recipient_changed': 'Updated recipient',
  'invoice.case_changed': 'Updated case details',
  'invoice.service_status_changed': 'Changed service status',
  'invoice.work_note_changed': 'Updated work note',
  'payment.recorded': 'Recorded payment',
  'credit.recorded': 'Issued credit',
  'invoice.voided': 'Voided invoice',
  'invoice.soft_deleted': 'Deleted invoice',
  'invoice.restored': 'Restored invoice',
  'invoice.void_restored': 'Restored voided invoice',
  'invoice.purged': 'Permanently deleted invoice',
  'payment.deleted': 'Deleted payment',
  'credit.deleted': 'Deleted credit',
  'work_status.changed': 'Changed work status',
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

// Header/case/service-status fields diffed by invoice edit actions.
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

// Recipient (Bill-To / Deliver-To) fields diffed by saveRecipientAction.
export const RECIPIENT_FIELD_LABELS: Record<string, string> = {
  bill_to_name: 'Bill-to name',
  bill_to_contact: 'Bill-to contact',
  bill_to_phone: 'Bill-to phone',
  billing_address: 'Billing address',
  ship_to_name: 'Deliver-to name',
  ship_to_contact: 'Deliver-to contact',
  delivery_address: 'Delivery address',
}

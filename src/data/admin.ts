// Read queries for the Super Admin Console. These use the service-role admin
// client because the console surfaces rows the normal UI hides (soft-deleted
// invoices, archived clinics, the audit log). The page gates on
// requireSuperadmin() before calling any of these.

import { createAdminClient } from '@/lib/supabase/admin'

export interface DeletedInvoiceRow {
  id: string
  invoice_number: string
  total: number
  deleted_at: string
  delete_reason: string | null
  customers: { clinic_name: string } | null
}

export interface ArchivedClinicRow {
  id: string
  clinic_name: string
  archived_at: string
  invoice_count: number
  credit_count: number
}

export interface AuditRow {
  id: string
  actor_id: string
  action: string
  entity_type: string
  entity_label: string | null
  reason: string | null
  created_at: string
}

export async function getDeletedInvoices(): Promise<DeletedInvoiceRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('invoices')
    .select('id, invoice_number, total, deleted_at, delete_reason, customers(clinic_name)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  return (data ?? []) as unknown as DeletedInvoiceRow[]
}

export async function getArchivedClinics(): Promise<ArchivedClinicRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('customers')
    .select('id, clinic_name, archived_at')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })
  const clinics = (data ?? []) as { id: string; clinic_name: string; archived_at: string }[]
  if (clinics.length === 0) return []

  // Dependency counts drive the "N invoices" badge and the cascade-delete blast
  // radius. Two batched queries (not one-per-clinic) then tallied in memory.
  const ids = clinics.map(c => c.id)
  const [{ data: invRows }, { data: creditRows }] = await Promise.all([
    admin.from('invoices').select('customer_id').in('customer_id', ids),
    admin.from('credits').select('customer_id').in('customer_id', ids),
  ])
  const tally = (rows: { customer_id: string }[] | null) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) m.set(r.customer_id, (m.get(r.customer_id) ?? 0) + 1)
    return m
  }
  const invByClinic = tally(invRows)
  const creditByClinic = tally(creditRows)

  return clinics.map(c => ({
    ...c,
    invoice_count: invByClinic.get(c.id) ?? 0,
    credit_count: creditByClinic.get(c.id) ?? 0,
  }))
}

export async function getAuditFeed(limit = 100): Promise<AuditRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_audit_log')
    .select('id, actor_id, action, entity_type, entity_label, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as AuditRow[]
}

export interface InvoiceActivityFeedRow {
  id: string
  actor_name: string
  action: string
  entity_label: string | null
  reason: string | null
  created_at: string
}

// Global per-invoice activity feed for the admin console (who did what, newest-first).
export async function getInvoiceActivityFeed(limit = 200): Promise<InvoiceActivityFeedRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('invoice_activity_log')
    .select('id, actor_name, action, entity_label, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as InvoiceActivityFeedRow[]
}

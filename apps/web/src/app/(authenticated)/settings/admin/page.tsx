import { redirect } from 'next/navigation'
import { requireSuperadmin } from '@/lib/auth/require-permission'
import { getDeletedInvoices, getArchivedClinics, getAuditFeed, getInvoiceActivityFeed, getInvoiceHealthIssues } from '@/data/admin'
import { AdminConsoleClient } from './AdminConsoleClient'

// Super Admin Console: recycle bin (restore/purge soft-deleted invoices + purge
// archived clinics) and the audit activity feed. Gated server-side to the
// built-in Super Admin role — no flash, data never loads for anyone else. RLS +
// the requireSuperadmin gate in each action are the backstops.
export default async function AdminConsolePage() {
  const gate = await requireSuperadmin()
  if (gate.ok === false) redirect('/dashboard')

  const [deletedInvoices, archivedClinics, audit, invoiceActivity, healthIssues] = await Promise.all([
    getDeletedInvoices(),
    getArchivedClinics(),
    getAuditFeed(),
    getInvoiceActivityFeed(),
    getInvoiceHealthIssues(),
  ])

  return (
    <AdminConsoleClient
      deletedInvoices={deletedInvoices}
      archivedClinics={archivedClinics}
      audit={audit}
      invoiceActivity={invoiceActivity}
      healthIssues={healthIssues}
    />
  )
}

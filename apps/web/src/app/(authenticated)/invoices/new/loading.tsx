import { Skeleton } from '@/components/ui/skeleton'

// Form-shaped skeleton: page header, then the three grouped sections (Invoice
// Details, Line Items, Remarks) and the action bar — mirrors InvoiceForm.
export default function InvoiceNewLoading() {
  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Invoice Details */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 sm:px-5"><Skeleton className="h-5 w-32" /></div>
        <div className="space-y-4 border-t border-border px-4 py-4 sm:px-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/2" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 sm:px-5"><Skeleton className="h-5 w-28" /></div>
        <div className="space-y-3 border-t border-border px-4 py-4 sm:px-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Remarks */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 sm:px-5"><Skeleton className="h-5 w-24" /></div>
        <div className="border-t border-border px-4 py-4 sm:px-5">
          <Skeleton className="h-20 w-full" />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

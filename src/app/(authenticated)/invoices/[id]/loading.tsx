import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

// Detail-shaped skeleton: action bar row, then the invoice document block —
// closer to the real page than the list skeleton one level up.
export default function InvoiceDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex justify-between">
            <Skeleton className="h-16 w-48" />
            <Skeleton className="h-16 w-40" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
          <div className="ml-auto w-56 space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-7 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

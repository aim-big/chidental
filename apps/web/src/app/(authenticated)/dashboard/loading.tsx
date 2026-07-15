import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-9 w-full max-w-xl" />

      {/* KPI metrics row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>

      {/* Work In Progress band */}
      <Card>
        <CardHeader className="pb-2"><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-7 w-10" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sales vs Cash Received trend */}
      <Card>
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>

      {/* Top products + top clinics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-36" /></CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Growth strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-24" />
          </Card>
        ))}
      </div>
    </div>
  )
}

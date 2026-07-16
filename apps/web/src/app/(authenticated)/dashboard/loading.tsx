import { Skeleton } from '@/components/ui/skeleton'

function MetricSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className={wide ? 'h-9 w-48' : 'h-7 w-32'} />
      <Skeleton className="h-3 w-36" />
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full sm:w-36" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-2xl" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="space-y-5 bg-accent/55 p-5 sm:col-span-2 sm:p-6 lg:col-span-1">
            <MetricSkeleton wide />
            <div className="border-t border-brand/15 pt-4"><Skeleton className="h-4 w-64 max-w-full" /></div>
          </div>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={`border-t border-border p-5 sm:p-6 lg:border-l lg:border-t-0 ${index === 2 ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
              <MetricSkeleton />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="space-y-2"><Skeleton className="h-5 w-36" /><Skeleton className="h-3 w-44" /></div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={`flex items-center gap-3 border-border px-5 py-4 ${index % 2 === 1 ? 'border-l' : ''} ${index > 1 ? 'border-t sm:border-t-0' : ''} ${index > 1 ? 'sm:border-l' : ''}`}>
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <div className="space-y-2"><Skeleton className="h-7 w-10" /><Skeleton className="h-3 w-16" /></div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(17rem,0.75fr)]">
        <section className="rounded-lg border border-border bg-card">
          <div className="space-y-2 border-b border-border px-5 py-4"><Skeleton className="h-5 w-48" /><Skeleton className="h-3 w-72 max-w-full" /></div>
          <div className="p-5"><Skeleton className="h-[280px] w-full sm:h-[320px]" /></div>
        </section>
        <aside className="rounded-lg bg-foreground p-5 sm:p-6">
          <Skeleton className="h-5 w-36 bg-card/20" />
          <Skeleton className="mt-2 h-3 w-full bg-card/15" />
          <div className="mt-6 space-y-6">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12 w-full bg-card/15" />)}
          </div>
        </aside>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="space-y-2 border-b border-border px-5 py-4"><Skeleton className="h-5 w-44" /><Skeleton className="h-3 w-64 max-w-full" /></div>
        <div className="grid lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, section) => (
            <div key={section} className={section === 1 ? 'border-t border-border p-5 sm:p-6 lg:border-l lg:border-t-0' : 'p-5 sm:p-6'}>
              <Skeleton className="h-4 w-28" />
              <div className="mt-5 space-y-5">
                {Array.from({ length: 5 }).map((_, row) => <Skeleton key={row} className="h-8 w-full" />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="overflow-hidden rounded-lg border border-border bg-surface-2">
        <div className="grid grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className={`space-y-2 border-border p-4 sm:p-5 ${index % 2 === 1 ? 'border-l' : ''} ${index > 1 ? 'border-t xl:border-t-0' : ''} ${index > 1 ? 'xl:border-l' : ''}`}><MetricSkeleton /></div>)}
        </div>
      </footer>
    </div>
  )
}

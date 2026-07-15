'use client'

import { ErrorState } from '@/components/ui/error-state'

export default function InvoiceDetailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="Couldn't load this invoice"
      description="There was a problem loading this invoice. Please try again."
      onRetry={reset}
    />
  )
}

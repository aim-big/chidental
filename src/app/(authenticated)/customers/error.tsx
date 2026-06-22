'use client'

import { ErrorState } from '@/components/ui/error-state'

export default function CustomersError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="Couldn't load customers"
      description="There was a problem loading the customer list. Please try again."
      onRetry={reset}
    />
  )
}

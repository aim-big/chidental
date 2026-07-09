'use client'

import { SelectItem } from '@/components/ui/select'
import { DEFAULT_COLOR } from '@/lib/service-status'
import { cn } from '@/lib/utils'
import type { ServiceStatus } from '@chidental/shared'

type ServiceStatusSelectItemProps = {
  status: Pick<ServiceStatus, 'id' | 'label' | 'color'>
}

export function ServiceStatusSelectItem({ status }: ServiceStatusSelectItemProps) {
  return (
    <SelectItem value={status.id} textValue={status.label} className="py-2">
      <span className={cn('inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-sm font-medium leading-5', status.color ?? DEFAULT_COLOR)}>
        <span className="truncate">{status.label}</span>
      </span>
    </SelectItem>
  )
}

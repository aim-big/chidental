import type { WorkStatus } from '@chidental/shared'
import { StatusPill, statusTone } from '@/components/ui/status-pill'
import { workStatusLabel, type WorkStatusDisplay } from '@/lib/work-status-config'

// Thin wrapper over the StatusPill authority (see /DESIGN.md §7): a work status
// renders as a semantic chip whose tone is derived from the status. Per-lab
// configured colours are class strings (not hex), so we map to the semantic tone
// rather than an accent dot. The label still honours the per-lab config override.
export function WorkStatusBadge({
  status,
  className,
  children,
  statusConfigs,
}: {
  status: WorkStatus
  className?: string
  children?: React.ReactNode
  statusConfigs?: WorkStatusDisplay[]
}) {
  return (
    <StatusPill tone={statusTone('work', status)} className={className}>
      {children ?? workStatusLabel(status, statusConfigs)}
    </StatusPill>
  )
}

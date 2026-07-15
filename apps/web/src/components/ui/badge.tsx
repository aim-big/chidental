import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Semantic, dark-mode-safe status chips. `success/warning/info/destructive` use the
// subtle chip tokens from the design system (see /DESIGN.md §1.3). For domain statuses,
// prefer <StatusPill> which maps payment/work status → the right tone + label.
const badgeVariants = cva(
  'inline-flex items-center rounded-md border border-transparent px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        success: 'bg-success-subtle text-success-subtle-foreground',
        warning: 'bg-warning-subtle text-warning-subtle-foreground',
        info: 'bg-info-subtle text-info-subtle-foreground',
        destructive: 'bg-danger-subtle text-danger-subtle-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

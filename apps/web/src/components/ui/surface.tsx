import * as React from 'react'
import { cn } from '@/lib/utils'

// Grouping primitive (see /DESIGN.md §7): a titled section with a hairline header and a
// flat body. Use INSTEAD of wrapping everything in a shadowed Card — sections + hairlines
// + whitespace do the organising. Never nest Surfaces.

export interface SurfaceProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** Remove body padding (e.g. when the body is a table). */
  flush?: boolean
  /** Render body without the outer border/background (a bare grouped section). */
  bare?: boolean
  as?: 'section' | 'div'
  bodyClassName?: string
}

export function Surface({
  title,
  description,
  actions,
  flush = false,
  bare = false,
  as = 'section',
  className,
  bodyClassName,
  children,
  ...props
}: SurfaceProps) {
  const Comp = as as React.ElementType
  return (
    <Comp
      className={cn(!bare && 'rounded-lg border border-border bg-card', className)}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold leading-none text-foreground">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div
        className={cn(
          !flush && 'px-4 py-4 sm:px-5',
          (title || actions) && 'border-t border-border',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </Comp>
  )
}

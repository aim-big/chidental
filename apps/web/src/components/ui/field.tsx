import * as React from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// One form-field recipe (see /DESIGN.md §7): label (associated) + control + error text
// wired via aria-describedby with role="alert". Clone the control to inject id / aria-*.

let uid = 0
function useFieldId(explicit?: string) {
  const [gen] = React.useState(() => explicit ?? `fld-${++uid}`)
  return gen
}

export interface FieldProps {
  label: React.ReactNode
  htmlFor?: string
  required?: boolean
  error?: string
  hint?: React.ReactNode
  className?: string
  children: React.ReactElement
}

export function Field({ label, htmlFor, required, error, hint, className, children }: FieldProps) {
  const id = useFieldId(htmlFor ?? (children.props as { id?: string }).id)
  const errorId = `${id}-error`
  const hintId = hint ? `${id}-hint` : undefined
  const describedBy = [error ? errorId : null, hintId].filter(Boolean).join(' ') || undefined

  const control = React.cloneElement(children, {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
    'aria-describedby': describedBy,
  } as Record<string, unknown>)

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </Label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">{error}</p>
      )}
    </div>
  )
}

export interface FieldChange {
  field: string
  label: string
  from: unknown
  to: unknown
}

// Normalize so empties (null/undefined/'') compare equal, and numeric strings
// compare by value. Everything else compares by its string form.
function norm(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return String(Number(v))
  return String(v)
}

// Compare `before` vs `after` for the keys listed in `labels` (others ignored),
// returning one FieldChange per changed field. Empty array when nothing changed.
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
): FieldChange[] {
  const changes: FieldChange[] = []
  for (const [field, label] of Object.entries(labels)) {
    if (norm(before[field]) !== norm(after[field])) {
      changes.push({ field, label, from: before[field] ?? null, to: after[field] ?? null })
    }
  }
  return changes
}

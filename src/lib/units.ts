/**
 * Option list for the product unit dropdown: the active unit labels, plus the
 * product's current value appended when it isn't among them (e.g. the unit was
 * deactivated or renamed). Keeps editing from silently dropping a stored unit.
 */
export function buildUnitOptions(active: string[], current?: string | null): string[] {
  if (current && !active.includes(current)) return [...active, current]
  return active
}

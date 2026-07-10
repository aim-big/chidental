import { redirect } from 'next/navigation'
import { getNavPermissions } from '@/lib/auth/require-permission'
import { settingsGroups } from '@/domain/navigation'

// /settings has no content of its own — it forwards to the first section the
// user can reach. Resolved on the SERVER (permissions + redirect) so there is no
// "Loading…" flash or client-only double navigation. A user with no config
// permission is sent to the dashboard; the sidebar wouldn't have shown them
// Settings anyway.
export default async function SettingsIndex() {
  const ctx = await getNavPermissions()
  const first = settingsGroups(ctx)[0]?.entries[0]?.href
  redirect(first ?? '/dashboard')
}

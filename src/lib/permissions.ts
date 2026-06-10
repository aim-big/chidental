// Fixed catalogue of capabilities shipped with the app. Users assign these to
// roles; they cannot invent new ones. Viewing screens is open to anyone logged
// in — these flags only gate changes (and report access). "edit" folds in
// create/edit/delete; invoices split edit (drafts) from manage (void + sent).
export const PERMISSIONS = {
  'invoices.edit': 'invoices.edit',
  'invoices.manage': 'invoices.manage',
  'customers.edit': 'customers.edit',
  'products.edit': 'products.edit',
  'services.edit': 'services.edit',
  'reports.view': 'reports.view',
  'staff.manage': 'staff.manage',
  'settings.manage': 'settings.manage',
} as const

export type Permission = keyof typeof PERMISSIONS

// Grouping is for display in the role editor only; underneath it is a flat list.
export const PERMISSION_GROUPS: { label: string; permissions: { key: Permission; label: string }[] }[] = [
  {
    label: 'Invoices',
    permissions: [
      { key: 'invoices.edit', label: 'Create & edit draft invoices' },
      { key: 'invoices.manage', label: 'Void, restore & edit sent invoices' },
    ],
  },
  {
    label: 'Records',
    permissions: [
      { key: 'customers.edit', label: 'Add & edit customers' },
      { key: 'products.edit', label: 'Add & edit products' },
      { key: 'services.edit', label: 'Add & edit service statuses' },
    ],
  },
  {
    label: 'Administration',
    permissions: [
      { key: 'reports.view', label: 'View reports' },
      { key: 'staff.manage', label: 'Manage employees' },
      { key: 'settings.manage', label: 'Manage settings' },
    ],
  },
]

// Pure grant check. A system role (Super Admin) implicitly holds every permission.
export function permissionGranted(
  role: { is_system: boolean; permissions: string[] },
  permission: string,
): boolean {
  return role.is_system || role.permissions.includes(permission)
}

// Lockout guard: true when this change would leave zero active Super Admins.
// `targetStaysSuperadmin` is false when the user is being demoted OR deactivated.
export function wouldRemoveLastSuperadmin(
  activeSuperadminIds: string[],
  targetUserId: string,
  targetStaysSuperadmin: boolean,
): boolean {
  if (targetStaysSuperadmin) return false
  return activeSuperadminIds.length === 1 && activeSuperadminIds[0] === targetUserId
}

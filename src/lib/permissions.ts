// Fixed catalogue of capabilities shipped with the app. Users assign these to
// roles; they cannot invent new ones. Adding a flag later = add a constant here
// plus a row to PERMISSION_GROUPS, then wire the gate where it applies.
export const PERMISSIONS = {
  createInvoice: 'createInvoice',
  editInvoice: 'editInvoice',
  deleteInvoice: 'deleteInvoice',
  voidInvoice: 'voidInvoice',
  editFinalizedInvoice: 'editFinalizedInvoice',
  applyDiscount: 'applyDiscount',
  createCustomer: 'createCustomer',
  editCustomer: 'editCustomer',
  deleteCustomer: 'deleteCustomer',
  createProduct: 'createProduct',
  editProduct: 'editProduct',
  deleteProduct: 'deleteProduct',
  createService: 'createService',
  editService: 'editService',
  deleteService: 'deleteService',
  viewReports: 'viewReports',
  manageEmployees: 'manageEmployees',
  manageSettings: 'manageSettings',
} as const

export type Permission = keyof typeof PERMISSIONS

// Grouping is for display in the role editor only; underneath it is a flat list.
export const PERMISSION_GROUPS: { label: string; permissions: { key: Permission; label: string }[] }[] = [
  {
    label: 'Invoices',
    permissions: [
      { key: 'createInvoice', label: 'Create invoices' },
      { key: 'editInvoice', label: 'Edit draft invoices' },
      { key: 'deleteInvoice', label: 'Delete invoices' },
      { key: 'voidInvoice', label: 'Void & restore invoices' },
      { key: 'editFinalizedInvoice', label: 'Edit sent/paid invoices' },
      { key: 'applyDiscount', label: 'Apply discounts / override prices' },
    ],
  },
  {
    label: 'Customers',
    permissions: [
      { key: 'createCustomer', label: 'Create customers' },
      { key: 'editCustomer', label: 'Edit customers' },
      { key: 'deleteCustomer', label: 'Delete customers' },
    ],
  },
  {
    label: 'Products',
    permissions: [
      { key: 'createProduct', label: 'Create products' },
      { key: 'editProduct', label: 'Edit products' },
      { key: 'deleteProduct', label: 'Delete products' },
    ],
  },
  {
    label: 'Services',
    permissions: [
      { key: 'createService', label: 'Create service statuses' },
      { key: 'editService', label: 'Edit service statuses' },
      { key: 'deleteService', label: 'Delete service statuses' },
    ],
  },
  { label: 'Reports', permissions: [{ key: 'viewReports', label: 'View reports' }] },
  { label: 'Staff', permissions: [{ key: 'manageEmployees', label: 'Manage employees' }] },
  { label: 'Settings', permissions: [{ key: 'manageSettings', label: 'Manage settings' }] },
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

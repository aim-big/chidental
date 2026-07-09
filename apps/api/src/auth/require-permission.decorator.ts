import { SetMetadata } from '@nestjs/common'

// Route metadata key the guard reads to enforce a permission on a handler.
export const REQUIRE_PERMISSION = 'require_permission'

/**
 * Gate a controller/handler on a permission key (e.g. 'invoices.manage').
 * Omit it for endpoints that only require a valid session (e.g. reads gated by
 * route access). The guard always requires authentication regardless.
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRE_PERMISSION, permission)

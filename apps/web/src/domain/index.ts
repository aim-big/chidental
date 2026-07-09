// Backend-safe domain (schemas, money, billing, permissions) + DB types now live
// in @chidental/shared. `production` stays here — it depends on the web-only
// work-status display config (lib/work-status-config).
export * from '@chidental/shared'
export * from './production'

'use server'

// Server-first data layer for the four settings taxonomies (units, service
// statuses, in-progress work stages, and the fixed work-status configs).
// Previously these were read AND written directly from the browser Supabase
// client, gated only by RLS. Every mutation here re-gates on `settings.manage`
// server-side (defense-in-depth on top of RLS) and runs via the service-role
// admin client, matching the pattern in billing-settings.ts.

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/require-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { fail, ok, type ActionResult } from '@/lib/action-result'
import type { Tables } from '@chidental/shared'

type Unit = Tables<'units'>
type ServiceStatus = Tables<'service_statuses'>
type WorkStage = Tables<'work_stages'>
type WorkStatusConfig = Tables<'work_status_configs'>

// Ordered taxonomies share {id, label, sort_order, is_active} plus (optionally) color.
type OrderedTable = 'units' | 'service_statuses' | 'work_stages'

async function gate(): Promise<ActionResult> {
  const g = await requirePermission('settings.manage')
  return g.ok === false ? fail(g.error) : ok(undefined)
}

async function listOrdered<T>(table: OrderedTable): Promise<T[]> {
  const supabase = await createClient()
  const { data } = await supabase.from(table).select('*').order('sort_order').order('label')
  return (data ?? []) as T[]
}

async function insertOrdered(
  table: OrderedTable,
  settingsPath: string,
  values: Record<string, unknown>,
): Promise<ActionResult> {
  const g = await gate()
  if (g.ok === false) return g
  const admin = createAdminClient()
  // Append after the current last row (display order = sort_order, then label).
  const { data: last } = await admin
    .from(table)
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = ((last?.sort_order as number | undefined) ?? 0) + 10
  // Runtime (union) table name defeats supabase-js's row typing — cast the payload.
  const { error } = await admin.from(table).insert({ ...values, sort_order: nextOrder, is_active: true } as never)
  if (error) return fail(error.message)
  revalidatePath(settingsPath)
  return ok(undefined)
}

async function updateOrdered(
  table: OrderedTable,
  settingsPath: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  const g = await gate()
  if (g.ok === false) return g
  const admin = createAdminClient()
  const { error } = await admin.from(table).update(patch as never).eq('id', id)
  if (error) return fail(error.message)
  revalidatePath(settingsPath)
  return ok(undefined)
}

// Swap the row's sort_order with its display neighbour in the given direction.
// The neighbour is resolved server-side from the authoritative row set so the
// caller cannot desync it.
async function moveOrdered(
  table: OrderedTable,
  settingsPath: string,
  id: string,
  dir: -1 | 1,
): Promise<ActionResult> {
  const g = await gate()
  if (g.ok === false) return g
  const admin = createAdminClient()
  const { data } = await admin.from(table).select('id, sort_order').order('sort_order').order('label')
  const rows = (data ?? []) as { id: string; sort_order: number }[]
  const idx = rows.findIndex(r => r.id === id)
  const target = rows[idx + dir]
  const current = rows[idx]
  if (!current || !target) return ok(undefined) // already at an end — no-op
  const { error } = await admin.from(table).upsert([
    { id: current.id, sort_order: target.sort_order },
    { id: target.id, sort_order: current.sort_order },
  ] as never)
  if (error) return fail(error.message)
  revalidatePath(settingsPath)
  return ok(undefined)
}

/* ----------------------------- Units ----------------------------- */
export async function getUnits(): Promise<Unit[]> {
  return listOrdered<Unit>('units')
}
export async function createUnit(label: string): Promise<ActionResult> {
  return insertOrdered('units', '/settings/units', { label: label.trim() })
}
export async function updateUnit(id: string, label: string): Promise<ActionResult> {
  return updateOrdered('units', '/settings/units', id, { label: label.trim() })
}
export async function toggleUnit(id: string, isActive: boolean): Promise<ActionResult> {
  return updateOrdered('units', '/settings/units', id, { is_active: isActive })
}
export async function moveUnit(id: string, dir: -1 | 1): Promise<ActionResult> {
  return moveOrdered('units', '/settings/units', id, dir)
}

/* ------------------------ Service statuses ------------------------ */
export async function getServiceStatuses(): Promise<ServiceStatus[]> {
  return listOrdered<ServiceStatus>('service_statuses')
}
export async function createServiceStatus(label: string, color: string): Promise<ActionResult> {
  return insertOrdered('service_statuses', '/settings/service-statuses', { label: label.trim(), color })
}
export async function updateServiceStatus(id: string, label: string, color: string): Promise<ActionResult> {
  return updateOrdered('service_statuses', '/settings/service-statuses', id, { label: label.trim(), color })
}
export async function toggleServiceStatus(id: string, isActive: boolean): Promise<ActionResult> {
  return updateOrdered('service_statuses', '/settings/service-statuses', id, { is_active: isActive })
}
export async function moveServiceStatus(id: string, dir: -1 | 1): Promise<ActionResult> {
  return moveOrdered('service_statuses', '/settings/service-statuses', id, dir)
}

/* -------------------------- Work stages --------------------------- */
export async function getWorkStages(): Promise<WorkStage[]> {
  return listOrdered<WorkStage>('work_stages')
}
export async function createWorkStage(label: string, color: string): Promise<ActionResult> {
  return insertOrdered('work_stages', '/settings/work-stages', { label: label.trim(), color })
}
export async function updateWorkStage(id: string, label: string, color: string): Promise<ActionResult> {
  return updateOrdered('work_stages', '/settings/work-stages', id, { label: label.trim(), color })
}
export async function toggleWorkStage(id: string, isActive: boolean): Promise<ActionResult> {
  return updateOrdered('work_stages', '/settings/work-stages', id, { is_active: isActive })
}
export async function moveWorkStage(id: string, dir: -1 | 1): Promise<ActionResult> {
  return moveOrdered('work_stages', '/settings/work-stages', id, dir)
}

/* --------------------- Work status configs ------------------------ */
// Fixed set keyed by the work_status enum — edit label/color only.
export async function getWorkStatusConfigs(): Promise<WorkStatusConfig[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('work_status_configs').select('*').order('sort_order')
  return (data ?? []) as WorkStatusConfig[]
}
export async function updateWorkStatusConfig(
  status: string,
  label: string,
  color: string,
): Promise<ActionResult> {
  const g = await gate()
  if (g.ok === false) return g
  const admin = createAdminClient()
  const { error } = await admin
    .from('work_status_configs')
    .update({ label: label.trim(), color })
    .eq('status', status as never)
  if (error) return fail(error.message)
  revalidatePath('/settings/work-statuses')
  return ok(undefined)
}

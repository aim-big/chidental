# Settings & Navigation IA Refactor — Design

**Date:** 2026-06-19
**Status:** Approved (design) — pending implementation plan
**Scope:** Information-architecture refactor of the app's navigation and Settings, plus a new self-service **Profile** area (separate from Settings). No new business-config features (Billing/Organization are reserved as structure only).

> **Profile vs Settings — the core distinction.** *Profile* is personal: your own login (PIN), your display name, your role — reached by clicking **yourself** (the user chip), like a social-media profile. *Settings* is workspace configuration (lab lookups, employees, roles) — reached from the sidebar and **only visible to users who hold a configuration permission**. A user with no config permission sees **no Settings entry at all**, but always has a Profile.

---

## 1. Problem

Three issues, all rooted in the same cause.

1. **Triple-declared routes.** Every destination's `(href, permission)` is repeated across three independent lists:
   - `navItems` — sidebar links — in `src/components/layout/AppShell.tsx`
   - `viewGuards` — deep-link redirect guards — in the same file
   - `visibleSections` — tiles — in `src/app/(authenticated)/settings/page.tsx`

   Adding or re-gating a route means editing three places that can silently disagree. This is why `Employees` ended up in both the sidebar and the Settings tile grid.

2. **"Tab inside tab" navigation.** Reaching any settings page takes two hops: **Sidebar → `/settings` (tile grid) → click tile → page**. Switching between two settings pages (e.g. Employees → Roles) bounces back out to the grid. There is no persistent settings sub-navigation.

3. **Sidebar mixes concerns.** Daily-work destinations (Customers, Invoices, Work…) sit alongside admin/config (Settings, Employees) with no separation.

## 2. Goals

- **One source of truth** per route — adding a future feature or permission is a one-line change.
- **Flatten settings navigation** — one click between settings sections, no tile-grid hop.
- **Separate daily work from configuration** in the sidebar.
- **Permission-flexible Settings** — Settings is *not* admin-only, but it *is* permission-gated. A user sees exactly the config sections their permissions allow; a user with no config permission sees no Settings entry; system/super admin sees all.
- **Separate, self-service Profile** — every user can change their own PIN and display name from their own Profile, independent of any Settings permission.

Non-goals: building Billing or Organization settings (structure reserved, not implemented); changing the permission model itself; touching invoice/work business logic.

## 3. Core design: the Route Registry

A single typed registry is the source of truth for every navigable destination.

```ts
// src/domain/navigation.ts  (new)
import type { Permission } from '@/domain/permissions'
import type { LucideIcon } from 'lucide-react'

export type NavArea = 'main' | 'settings'

export type NavEntry = {
  href: string
  label: string
  icon: LucideIcon
  area: NavArea
  permission?: Permission   // undefined = visible to all authenticated users
  group?: string            // settings-area grouping label, e.g. 'Lab Setup'
  superadminOnly?: boolean  // for Roles & Permissions (system-role gate, not a permission)
}

export const NAV: NavEntry[] = [ /* … see §4 and §5 … */ ]
```

Everything derives from `NAV`:

- **Sidebar** = `NAV.filter(area === 'main')`, then permission-filtered.
- **Settings sub-nav** = `NAV.filter(area === 'settings')`, grouped by `group`, permission-filtered.
- **Deep-link guards** = derived map of `href → permission` for every entry that has one (replaces the hand-maintained `viewGuards`).

Helper functions (pure, unit-testable):

```ts
canSee(entry: NavEntry, ctx: { hasPermission; isSuperadmin }): boolean
mainNav(ctx): NavEntry[]                 // ordered, filtered
settingsGroups(ctx): { group; entries }[] // grouped, filtered, empty groups dropped
guardFor(pathname): Permission | 'superadmin' | null  // longest-prefix match
```

`canSee` rule: `superadminOnly ? isSuperadmin : (!permission || hasPermission(permission))`. Super admin passes every check (already true via `permissionGranted`/`isSuperadmin`).

**Profile is intentionally NOT in the registry.** It is the user's own page, reached from the user chip, available to everyone — not a permission-gated nav destination. Keeping it out of `NAV` is what lets Settings be hidden for non-config users without also hiding Profile.

## 4. Sidebar (the `main` area)

Daily-work destinations, with a single **Settings** entry pinned at the bottom and visually separated.

```
┌─────────────────┐
│ 🦷 Chi Dental   │
│ ▣ Dashboard     │   (no permission — always)
│ ◷ Customers     │   customers.view
│ ▤ Invoices      │   invoices.view
│ ⚒ Work          │   invoices.view
│ ▦ Products      │   products.view
│ ▥ Reports       │   reports.view
│  ·············  │   divider (margin-top:auto pushes block down)
│ ⚙ Settings      │   → /settings  (only if user has a config perm)
│ ───────────────│
│ 👤 admin ·S.Adm │   user chip → /profile (clickable)   ⏻ Sign out
└─────────────────┘
```

**Changes from today:**
- **Remove** the standalone `Employees` sidebar link (it lives inside Settings).
- **Settings** is a pinned bottom item, **conditionally rendered**.
- **User chip becomes a link to `/profile`** (the social-media pattern: click yourself to manage your account). Sign out stays adjacent.

**Settings visibility rule:** show the Settings entry **iff `settingsGroups(ctx)` is non-empty** — i.e. the user holds at least one configuration permission (`services.edit`, `settings.manage`, `staff.manage`, or superadmin). A user with none of these sees **no Settings entry**. Profile is the separate, always-available personal area and does **not** count toward Settings visibility.

## 5. Settings (the `settings` area) — two-pane layout

### Layout
A Next.js layout `src/app/(authenticated)/settings/layout.tsx` renders a persistent two-pane shell:

```
┌──────────── Settings ─────────────────────────────┐
│  LAB SETUP           │                             │
│ › Service Statuses   │   <selected section's page> │
│   Work Stages        │                             │
│                      │                             │
│  TEAM & ACCESS       │                             │
│   Employees          │                             │
│   Roles & Perms      │                             │
└──────────────────────┴─────────────────────────────┘
```

- Left rail = `settingsGroups(ctx)`: grouped, permission-filtered, empty groups omitted.
- Right pane = the routed child page.
- `/settings` (index) **redirects** to the first visible section for that user (no more tile grid). The old `visibleSections` tile array is deleted. If the user has no visible section (no config permission), `/settings` redirects to `/dashboard`.
- One click switches sections; the rail persists.
- Settings contains **no personal/account section** — that is Profile (§6), a separate top-level area.

### Section catalogue (this refactor)

| Group | Section | Route | Gate | Status |
|---|---|---|---|---|
| Lab Setup | Service Statuses | `/settings/service-statuses` | `services.edit` | exists — rehomed |
| Lab Setup | Work Stages | `/settings/work-stages` | `settings.manage` | exists — rehomed |
| Team & Access | Employees | `/settings/employees` | `staff.manage` | exists — rehomed |
| Team & Access | Roles & Permissions | `/settings/roles` | superadminOnly | exists — rehomed |

> Note: Service Statuses' settings gate is `services.edit` (configuring is an edit action). `services.view` remains used elsewhere (invoice creation) and is unchanged.

### Reserved groups (structure only — NOT built now)
`Billing & Invoices` (numbering, tax, terms — `settings.manage`) and `Organization` (company profile/logo — `settings.manage`). They are documented here so future entries slot into existing groups without redesign. No routes, pages, or registry rows are added for them now.

## 6. Profile (new, top-level — NOT under Settings)

**Route:** `/profile` — a standalone top-level route, available to every authenticated user. **Reached by clicking the user chip** at the bottom of the sidebar (the social-media pattern), *not* from the Settings rail. It is not part of the `settings` nav area and does not affect Settings visibility.

**Capabilities:**
1. **Change my PIN** — 6-digit, validated (reuse the existing PIN rules from `employee-actions`). Uses the user's **own session**: `supabase.auth.updateUser({ password })`. No elevated permission required.
2. **Change my display name** — updates `profiles.full_name` for the caller's own row.
3. **Read-only:** my User ID (username), my role name, and the list of permissions my role grants (informational).

**Data flow / dependency:** `profiles` UPDATE is currently admin-only (RLS `profiles_update_admin = is_admin()`), so a non-admin cannot change their own `full_name` via the session client. The name change therefore goes through a **new server action** `updateMyProfile({ fullName })` that:
- resolves the caller from the session (`auth.getUser()`),
- updates **only that user's own** profile row via the service-role client,
- never accepts a target id (caller can only edit themselves).

**Decision:** the PIN change is wrapped in a `changeMyPin({ pin })` server action (not done inline client-side), for consistency with the rest of the app's server-action pattern and to centralise the 6-digit validation. It resolves the caller from the session and changes only their own password; it accepts no target id.

**Security boundary:** both Profile actions operate exclusively on `auth.uid()`; there is no id parameter, so Profile can never be used to modify another user. This is distinct from the admin `resetPin`/`updateEmployee` actions, which remain `staff.manage`-gated.

## 7. Files & components

**New**
- `src/domain/navigation.ts` — the registry + pure helpers (`canSee`, `mainNav`, `settingsGroups`, `guardFor`).
- `src/app/(authenticated)/settings/layout.tsx` — two-pane shell + grouped sub-nav (client; uses `useAuth`).
- `src/app/(authenticated)/profile/page.tsx` — Profile (top-level, not under settings).
- `src/components/profile/ProfileManager.tsx` — Profile form (client).
- `src/lib/auth/account-actions.ts` — `updateMyProfile` and `changeMyPin` (both self-only, no id parameter).
- Unit tests for the registry helpers.

**Changed**
- `src/components/layout/AppShell.tsx` — sidebar derives from `mainNav()`; Settings pinned at bottom and conditionally rendered; user chip becomes a link to `/profile`; deep-link guards derive from `guardFor()`. Remove inline `navItems` and `viewGuards`.
- `src/app/(authenticated)/settings/page.tsx` — becomes a redirect to the first visible section; delete the tile grid.

**Unchanged** (only rehomed under the new layout): `service-statuses`, `work-stages`, `employees`, `roles` page implementations.

## 8. Testing

- **Unit:** registry helpers — `canSee` for each role × entry; `settingsGroups` drops empty groups; `guardFor` longest-prefix wins; Settings-visible iff any config group visible.
- **Manual/Playwright per role** (reuse the harness from earlier): Super Admin sees all groups; a `staff.manage`-only user sees Team & Access but not Lab Setup; a plain user (no config perm) sees **no Settings entry** but still has a Profile; deep-linking a forbidden settings route still redirects to `/dashboard`.
- **Profile:** a non-admin can change own PIN (re-login with new PIN) and own name; cannot affect another user (no id surface).

## 9. Migration / rollout

Pure front-end IA + self-scoped server actions. No schema changes required for the IA or Profile (uses existing `profiles`/auth). The reserved Billing/Organization groups would later need their own tables — out of scope here.

## 10. Open questions

None blocking. Decided: **Profile is separate from Settings** — a top-level `/profile` reached from the user chip; Settings is config-only and **hidden** for users with no configuration permission; Billing/Organization reserved as structure only.

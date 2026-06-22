# Phase 0c — Roll DataTable across Invoices & Customers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt the shared `DataTable` + `statusBadgeVariant` + `EmptyState` + route loading/error states in the Invoices and Customers lists, replacing their hand-rolled tables — behavior preserved, coherence gained.

**Architecture:** Extend `DataTable` with an optional `onRowClick` (both lists have clickable rows), then refactor each list's `Card`/`Table` block into `DataTable` with column definitions. Retire the duplicate `STATUS_VARIANT` map in `InvoiceListClient` in favor of the shared `statusBadgeVariant`. Add `loading.tsx`/`error.tsx` per route mirroring the Products pattern from Phase 0a.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict:false), Tailwind v4, Supabase, shadcn-style primitives, vitest.

## Global Constraints

- Branch: `feat/redesign-program` (already checked out). Do NOT touch `main`.
- **Behavior-preserving refactor.** No pagination is added (server pagination is Phase 1). No naming changes (customer→clinic rename is Phase 1). Same columns, same filters, same row-click navigation, same empty copy intent.
- Do NOT touch the invoice **detail/form** files (`InvoiceForm.tsx`, `ProductSearchAdd.tsx`, `invoices/[id]/page.tsx`, `InvoiceDocument.tsx`, `invoice-actions.ts`, `ActionsBar.tsx`) — they have unrelated uncommitted work nearby. This plan is lists only.
- TypeScript `strict: false`: narrow unions with `=== false`, never `!`.
- Currency MYR via `formatCurrency`; money columns right-aligned + `tabular-nums`.
- No new npm dependencies. Reuse the Phase 0a primitives (`DataTable`, `EmptyState`, `Skeleton`, `statusBadgeVariant`, `listViewState`, `Column`).
- Quality gates: `npx tsc --noEmit`, `npm run lint`, `npm test`. Dev server port 6060 (do not start it).

---

### Task 1: Add `onRowClick` to DataTable

Both lists navigate on row click; the primitive needs to support it.

**Files:**
- Modify: `src/components/ui/data-table.tsx`

**Interfaces:**
- Produces: `DataTableProps<T>` gains `onRowClick?: (row: T) => void`. When provided, rows get `cursor-pointer` and an `onClick`.

- [ ] **Step 1: Add the prop to the interface**

In `src/components/ui/data-table.tsx`, add to the `DataTableProps<T>` interface (after `rowClassName?`):

```tsx
  onRowClick?: (row: T) => void
```

- [ ] **Step 2: Destructure and wire it**

In the function signature destructuring, add `onRowClick` to the params. Replace the rows-rendering `<TableRow …>` (the one in the `!loading && rows.map(...)` block) with:

```tsx
              <TableRow
                key={rowKey(row)}
                className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row))}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
```

- [ ] **Step 3: Verify gates**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tsc exits 0, lint clean, 134 tests pass (Products list, the existing consumer, still compiles — it passes no `onRowClick`, which is optional).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/data-table.tsx
git commit -m "feat(ui): DataTable onRowClick support"
```

---

### Task 2: Invoices list → DataTable + shared status badge + route states

**Files:**
- Modify: `src/components/invoices/InvoiceListClient.tsx`
- Create: `src/app/(authenticated)/invoices/loading.tsx`
- Create: `src/app/(authenticated)/invoices/error.tsx`

**Interfaces:**
- Consumes: `DataTable`, `Column`, `EmptyState`, `listViewState`, `statusBadgeVariant` (Phase 0a); `WorkStatusBadge`, `dominantWorkStatus`, `isVoided`, `isOverdue`, `DEFAULT_COLOR` (existing).

- [ ] **Step 1: Update imports and delete the local STATUS_VARIANT**

In `src/components/invoices/InvoiceListClient.tsx`:

Replace the table-primitive import:
```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
```
with:
```tsx
import { DataTable } from '@/components/ui/data-table'
import type { Column } from '@/lib/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { listViewState } from '@/lib/list-view-state'
import { statusBadgeVariant } from '@/lib/status-badge'
import { FileText } from 'lucide-react'
```

Delete the local `STATUS_VARIANT` constant (lines 26-28):
```tsx
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
  draft: 'secondary', sent: 'info', partial: 'warning', paid: 'success', overdue: 'destructive',
}
```

- [ ] **Step 2: Define columns + empty state above the return**

Immediately before `return (`, add:

```tsx
  const columns: Column<InvoiceListRow>[] = [
    { key: 'number', header: 'Invoice #', cell: inv => <span className="font-medium text-primary">{inv.invoice_number}</span> },
    { key: 'customer', header: 'Customer', cell: inv => <span className="text-gray-700">{inv.customers?.clinic_name ?? '—'}</span> },
    { key: 'patient', header: 'Patient', cell: inv => <span className="text-gray-700">{inv.patient ?? '—'}</span> },
    { key: 'date', header: 'Date', cell: inv => <span className="text-sm text-gray-500">{formatDate(inv.invoice_date)}</span> },
    { key: 'due', header: 'Due Date', cell: inv => <span className="text-sm text-gray-500">{formatDate(inv.due_date)}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: inv => <span className="font-medium tabular-nums">{formatCurrency(inv.total)}</span> },
    {
      key: 'payment',
      header: 'Payment',
      cell: inv =>
        isVoided(inv) ? (
          <Badge variant="destructive" className="uppercase">Voided</Badge>
        ) : isOverdue(inv, today) ? (
          <Badge variant="destructive" className="capitalize">Overdue</Badge>
        ) : (
          <Badge variant={statusBadgeVariant('payment', inv.status)} className="capitalize">{inv.status}</Badge>
        ),
    },
    {
      key: 'work',
      header: 'Work',
      cell: inv => {
        const dominant = dominantWorkStatus((inv.invoice_items ?? []).map(it => it.work_status))
        return dominant ? <WorkStatusBadge status={dominant} /> : <span className="text-xs text-gray-400">—</span>
      },
    },
    {
      key: 'service',
      header: 'Service',
      cell: inv =>
        inv.service_statuses ? (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', inv.service_statuses.color ?? DEFAULT_COLOR)}>
            {inv.service_statuses.label}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
  ]

  const hasQuery = search.trim() !== '' || statusFilter !== 'all' || workFilter !== 'all'
  const view = listViewState({ loading: false, total: invoices.length, filtered: filtered.length, hasQuery })
  const emptyState = (
    <EmptyState
      icon={<FileText className="h-8 w-8" />}
      title={view === 'empty-no-results' ? 'No invoices match your filters' : 'No invoices yet'}
      description={view === 'empty-no-results' ? 'Try a different search or filter.' : 'Create your first invoice to get started.'}
    />
  )
```

- [ ] **Step 3: Replace the Card/Table block**

Replace the entire `<Card>…</Card>` block (currently containing `<Table>…</Table>`) with:

```tsx
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={inv => inv.id}
            onRowClick={inv => router.push(`/invoices/${inv.id}`)}
            empty={emptyState}
          />
        </CardContent>
      </Card>
```

- [ ] **Step 4: Create route loading + error states**

```tsx
// src/app/(authenticated)/invoices/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function InvoicesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

```tsx
// src/app/(authenticated)/invoices/error.tsx
'use client'

import { ErrorState } from '@/components/ui/error-state'

export default function InvoicesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="Couldn't load invoices"
      description="There was a problem loading the invoice list. Please try again."
      onRetry={reset}
    />
  )
}
```

- [ ] **Step 5: Verify gates**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tsc exits 0 (if `Badge` is now unused remove it; it is still used in the payment column so it stays), lint clean, 134 tests pass.

- [ ] **Step 6: Commit**

```bash
git add "src/components/invoices/InvoiceListClient.tsx" "src/app/(authenticated)/invoices/loading.tsx" "src/app/(authenticated)/invoices/error.tsx"
git commit -m "feat(invoices): list on shared DataTable + statusBadgeVariant + route states"
```

---

### Task 3: Customers list → DataTable + route states

**Files:**
- Modify: `src/components/customers/CustomerListClient.tsx`
- Create: `src/app/(authenticated)/customers/loading.tsx`
- Create: `src/app/(authenticated)/customers/error.tsx`

**Interfaces:**
- Consumes: `DataTable`, `Column`, `EmptyState`, `listViewState`.

- [ ] **Step 1: Update imports**

In `src/components/customers/CustomerListClient.tsx`, replace:
```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
```
with:
```tsx
import { DataTable } from '@/components/ui/data-table'
import type { Column } from '@/lib/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { listViewState } from '@/lib/list-view-state'
import { Users } from 'lucide-react'
```

- [ ] **Step 2: Define columns + empty state above the return**

Immediately before `return (`, add:

```tsx
  const columns: Column<Customer>[] = [
    { key: 'clinic', header: 'Clinic / Name', cell: c => <span className="font-medium text-gray-900">{c.clinic_name}</span> },
    { key: 'contact', header: 'Contact Person', cell: c => <span className="text-gray-600">{c.contact_person ?? '—'}</span> },
    { key: 'phone', header: 'Phone', cell: c => <span className="text-gray-600">{c.phone ?? '—'}</span> },
    { key: 'email', header: 'Email', cell: c => <span className="text-gray-600">{c.email ?? '—'}</span> },
    { key: 'registered', header: 'Registered', cell: c => <span className="text-sm text-gray-400">{formatDate(c.created_at)}</span> },
  ]

  const view = listViewState({ loading: false, total: customers.length, filtered: filtered.length, hasQuery: search.trim() !== '' })
  const emptyState = (
    <EmptyState
      icon={<Users className="h-8 w-8" />}
      title={view === 'empty-no-results' ? 'No customers match your search' : 'No customers yet'}
      description={view === 'empty-no-results' ? 'Try a different search term.' : 'Add your first customer to get started.'}
    />
  )
```

- [ ] **Step 3: Replace the Card/Table block**

Replace the `<Card>…</Card>` block (containing `<Table>…</Table>`) with:

```tsx
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={c => c.id}
            onRowClick={c => router.push(`/customers/${c.id}`)}
            empty={emptyState}
          />
        </CardContent>
      </Card>
```

- [ ] **Step 4: Create route loading + error states**

```tsx
// src/app/(authenticated)/customers/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function CustomersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-9 w-full max-w-sm" />
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-4 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

```tsx
// src/app/(authenticated)/customers/error.tsx
'use client'

import { ErrorState } from '@/components/ui/error-state'

export default function CustomersError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="Couldn't load customers"
      description="There was a problem loading the customer list. Please try again."
      onRetry={reset}
    />
  )
}
```

- [ ] **Step 5: Verify gates**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tsc exits 0, lint clean, 134 tests pass.

- [ ] **Step 6: Commit**

```bash
git add "src/components/customers/CustomerListClient.tsx" "src/app/(authenticated)/customers/loading.tsx" "src/app/(authenticated)/customers/error.tsx"
git commit -m "feat(customers): list on shared DataTable + route states"
```

---

## Self-Review

- **Spec coverage:** DataTable adopted in Invoices (Task 2) + Customers (Task 3); shared `statusBadgeVariant` wired into the invoice payment badge and the duplicate `STATUS_VARIANT` retired (Task 2 Step 1); route loading/error states added for both (Tasks 2, 3); `onRowClick` added to the primitive (Task 1). Work queue intentionally excluded (becomes the Phase 2 Cases workspace). No pagination/naming changes (Phase 1).
- **Placeholder scan:** none — exact code or commands in every step.
- **Type consistency:** `onRowClick?: (row: T) => void` defined in Task 1 is consumed identically in Tasks 2-3; `Column<InvoiceListRow>` and `Column<Customer>` use the Phase 0a `Column<T>`; `statusBadgeVariant('payment', inv.status)` matches the Phase 0a signature.

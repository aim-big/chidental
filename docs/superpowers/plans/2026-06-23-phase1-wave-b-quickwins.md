# Phase 1 Wave B — Audit quick-wins (dashboard revenue bug, clickable clinic contacts, product filter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix the dashboard month-revenue off-by-one bug, make clinic phone/email tappable (+ WhatsApp), and add an active/inactive filter to the products list.

**Architecture:** Three independent, self-contained quick-wins, each one file. None touch the forbidden invoice files or the database.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict:false), Tailwind v4, date-fns (already a dependency), vitest.

## Global Constraints

- Branch `feat/redesign-program` (never touch main).
- **Do NOT touch:** `InvoiceForm.tsx`, `ProductSearchAdd.tsx`, `InvoiceDocument.tsx`, `invoices/[id]/page.tsx`, `src/data/invoice-actions.ts`.
- TypeScript strict:false — narrow with `=== false`.
- Use brand tokens (`text-foreground`, `text-muted-foreground`, `text-primary`, `bg-card`, `border-border`), NOT raw `text-gray-*`.
- `date-fns` is already installed; import what you need.
- Gates: `npx tsc --noEmit`, `npm run lint`, `npm test`. Dev server port 6060 (do not start it).

---

### Task 1: Fix the dashboard month-revenue boundary

**Files:**
- Modify: `src/app/(authenticated)/dashboard/page.tsx`

**Bug:** line 20 `new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]` builds local midnight first-of-month, then `.toISOString()` shifts to UTC — in MYT (UTC+8) that yields the *previous* month's last day (e.g. `2026-05-31` for June). The revenue filter `i.due_date >= firstOfMonth` then includes last-day-of-previous-month invoices and has no upper bound.

- [ ] **Step 1: Read `src/data/dashboard.ts`** to confirm which date fields `statsInvoices` rows carry (`invoice_date` and/or `due_date`). Bucket revenue by `invoice_date` if present (matches `reports.ts`); otherwise keep `due_date`.

- [ ] **Step 2: Replace the boundary computation + filter**

Add the import:
```tsx
import { startOfMonth, addMonths, format } from 'date-fns'
```
Replace lines 19-23 (the `firstOfMonth` const and the `revenue` filter) with (using `invoice_date` if it exists on the rows, else `due_date` — pick the confirmed field):
```tsx
  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const nextMonthStart = format(startOfMonth(addMonths(now, 1)), 'yyyy-MM-dd')
  const revenue = statsInvoices
    .filter(i => countsAsRevenue(i) && i.invoice_date >= monthStart && i.invoice_date < nextMonthStart)
    .reduce((s, i) => s + Number(i.total), 0)
```
`format(startOfMonth(now), …)` uses the LOCAL calendar day (no UTC shift), and `nextMonthStart` adds the missing upper bound. If `statsInvoices` rows expose `due_date` not `invoice_date`, substitute `i.due_date` in both comparisons.

- [ ] **Step 3: Verify gates**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tsc exits 0 (if the chosen date field isn't on the row type, switch to the one that is), lint clean, 134 tests pass.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authenticated)/dashboard/page.tsx"
git commit -m "fix(dashboard): correct month-revenue boundary (local first-of-month + upper bound)"
```

---

### Task 2: Clickable clinic contacts (tel / mailto / WhatsApp) + token cleanup

**Files:**
- Modify: `src/app/(authenticated)/customers/[id]/page.tsx`

This is a Server Component; plain `<a>` links need no client code. The file also still uses raw `text-gray-*` (it was not in the earlier token sweep) — clean those up in the same pass.

- [ ] **Step 1: Add a WhatsApp icon import**

Change the lucide import to include `MessageCircle`:
```tsx
import { Phone, Mail, MapPin, Truck, MessageCircle } from 'lucide-react'
```

- [ ] **Step 2: Make phone + email clickable and add WhatsApp**

Replace the phone block (lines 32-37) with a tappable phone link plus a WhatsApp link (digits-only number):
```tsx
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${customer.phone}`} className="text-primary hover:underline">{customer.phone}</a>
                <a
                  href={`https://wa.me/${customer.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                </a>
              </div>
            )}
```
Replace the email block (lines 38-43) with:
```tsx
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${customer.email}`} className="text-primary hover:underline">{customer.email}</a>
              </div>
            )}
```

- [ ] **Step 3: Sweep this file's raw grays to tokens**

In the same file, replace remaining `text-gray-400` → `text-muted-foreground`, `text-gray-500` → `text-muted-foreground`, `text-gray-900` → `text-foreground` (the address icons, the "Billing/Delivery Address" labels, the notes text, the Total Billed/Outstanding labels and amounts).

- [ ] **Step 4: Verify gates**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tsc exits 0, lint clean, 134 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authenticated)/customers/[id]/page.tsx"
git commit -m "feat(customers): tappable phone/email/WhatsApp on clinic detail + token cleanup"
```

---

### Task 3: Active/inactive filter on the products list

**Files:**
- Modify: `src/components/products/ProductsClient.tsx`

Add a status filter to the existing `ListToolbar` children slot. Default to showing **active only** (declutter discontinued products; reachable via the filter).

- [ ] **Step 1: Read the current file** to confirm the `usePaginatedList` wiring and `ListToolbar` usage (it was token-swept; structure unchanged).

- [ ] **Step 2: Add an active-filter state + apply it before pagination**

Add state near the other `useState`s:
```tsx
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const visibleProducts = products.filter(p =>
    activeFilter === 'all' ? true : activeFilter === 'active' ? p.active : !p.active,
  )
```
Pass `visibleProducts` (not `products`) into `usePaginatedList(...)`.

- [ ] **Step 3: Render the filter inside ListToolbar**

Put a `Select` in the `ListToolbar`'s children slot (it renders right-aligned):
```tsx
      <ListToolbar value={query} onChange={setQuery} placeholder="Search products…">
        <Select value={activeFilter} onValueChange={v => setActiveFilter(v as 'active' | 'inactive' | 'all')}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </ListToolbar>
```
(`Select*` is already imported in this file.)

- [ ] **Step 4: Verify gates**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tsc exits 0, lint clean, 134 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/ProductsClient.tsx
git commit -m "feat(products): active/inactive filter (default active) in the list toolbar"
```

---

## Self-Review

- **Spec coverage:** dashboard boundary fixed with local month start + upper bound (Task 1); phone/email/WhatsApp links + token cleanup (Task 2); product status filter defaulting to active (Task 3).
- **Placeholder scan:** none — concrete code; Tasks 1 & 3 instruct reading the current file/data shape to pick the right field/wiring.
- **Constraint check:** no forbidden file touched; tokens used; `date-fns` already present.

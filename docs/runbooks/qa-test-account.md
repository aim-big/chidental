# Runbook — QA test account & TEST clinic

A dedicated account for verifying **production** end-to-end (prod auth via Supabase +
data via the NestJS/Railway API + Vercel web) without touching real staff credentials.

## The account

| | |
|---|---|
| **User ID** | `qa_tester` |
| Display name | `QA Tester (automated — do not delete)` |
| Role | **Super Admin** (full access — needed to exercise every module) |
| Auth identity | `qa_tester@chidentallab.local` (User ID → synthetic email, PIN = password) |
| Profile / `auth.users` id | `7840e357-d566-447d-b495-f46ea54aca5e` |
| **Current PIN** | **Not stored here** — never commit a prod credential to git. It lives in Claude Code's memory (`project_qa_test_account`); ask an admin, or rotate it (below). |

This is a **separate** account from the shared `admin` login — so the shared PIN never
has to be handed around for testing, and this account's activity is independently
attributable in `invoice_activity_log` / `admin_audit_log`.

## The TEST clinic

| | |
|---|---|
| Clinic name | `ZZ — TEST CLINIC (QA, do not bill)` |
| `customers.id` | `52f587d9-00cc-431c-ba8f-65d97d44a2df` |

Create any test invoices / work under **this** clinic so they stay separable from the
9 real clinics. (Note: it bumps the dashboard's "total clinics" count by 1 and has no
invoices, so it does not affect sales/AR figures.)

## How to test

1. Go to https://chidental.vercel.app/login
2. Sign in with User ID `qa_tester` + the current PIN.
3. Exercise the flow (dashboard, invoices, reports, a PDF). For write tests, pick the
   **ZZ — TEST CLINIC** as the clinic.

## Rotate the PIN

Preferred (in-app): **Settings → Employees → `qa_tester` → Reset PIN**.

Or script it (uses the service-role key from `apps/web/.env.local`):

```js
// node from repo root, with @supabase/supabase-js resolvable
import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } })
await admin.auth.admin.updateUserById('7840e357-d566-447d-b495-f46ea54aca5e', { password: '<new 6-digit PIN>' })
```

After rotating, update the PIN in Claude's memory note `project_qa_test_account`.

## Disable / re-enable

- Disable: **Settings → Employees → deactivate** (bans the auth user — cannot log in).
- Re-enable: reactivate (also resets the ban). Remember: an inactive account **cannot**
  be used to test login.

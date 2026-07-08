# Runbook — Provision the staging Supabase project + Vercel Preview

> **Owner action.** These steps touch cloud consoles and secrets, so they are not
> automated by the codebase. Do them once; after that, every PR's Vercel Preview
> runs against staging, never production.

**Why:** Vercel Preview deployments run untrusted PR code. They must point at a
**staging** Supabase project so a preview can never read or mutate production
data. Production (`ref xjwkmlmkwpbxjziyngmb`) stays wired only to the Vercel
Production environment.

## 1. Create the staging Supabase project

1. Supabase dashboard → **New project** → name `chidental-lab-staging`, same
   region as production.
2. Note its **Project URL**, **anon key**, and **service-role key**
   (Project → Settings → API).

## 2. Apply the schema to staging

The API introduces no schema of its own; staging just needs the same migrations
production has.

```bash
supabase link --project-ref <staging-ref>
supabase db push          # applies everything in supabase/migrations/
```

(Or apply the migrations to the staging ref via the Supabase MCP `apply_migration`,
keeping the same prod-aligned version timestamps.)

## 3. Seed staging with a login user + sample data

```bash
supabase db reset --linked   # runs migrations + supabase/seed.sql on staging
```

This creates the seed login **User ID `seedowner` / PIN `123456`** plus a sample
clinic, product, and invoice. Confirm you can log in to a staging URL with it.

> ⚠️ Never run `seed.sql` against production.

## 4. Wire Vercel Preview to staging

In Vercel → Project → **Settings → Environment Variables**, set for the **Preview**
scope only (leave **Production** on the prod project):

| Var | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | staging project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service-role key |

## 5. Verify

1. Open a PR; wait for the Vercel Preview deployment.
2. Log in on the preview URL with `seedowner` / `123456`.
3. Confirm the data you see is the **staging** sample data, not production.

**Do not** put the production ref (`xjwkmlmkwpbxjziyngmb`) in any Preview-scope
variable.

# data/

The ONLY place that talks to Supabase. One module per aggregate.
Reads are server-side query functions (called from Server Components).
Writes are Server Actions ('use server') and call `revalidateTag(...)`.
Filled in during Plan 2. Components must never import `@/lib/supabase` directly.

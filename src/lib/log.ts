// Server-side error logging for Server Actions and data loaders.
//
// Next.js never sends a thrown Server Action / Server Component error to the
// browser raw — the client only receives a generic, digested message ("An error
// occurred in the Server Components render…"). That message is useless to a user
// and useless to a developer. So the rule is: actions catch their own errors,
// log the real one HERE (terminal in dev, hosting platform logs in prod), and
// return a short, friendly `{ ok: false, error }` the UI can show verbatim.
//
// `scope` is a greppable tag (e.g. 'voidInvoice') so a report from the field can
// be found in the logs quickly.
export function logServerError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  console.error(
    `[server-error] ${scope}: ${err.message}`,
    { stack: err.stack, ...(context ?? {}) },
  )
}

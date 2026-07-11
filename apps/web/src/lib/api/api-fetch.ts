// Drop-in `fetch` for calls to the NestJS API. A connection-level failure (API
// process not running, port unreachable) surfaces from undici as an opaque
// `TypeError: fetch failed`; rethrow it naming the API origin — and, in dev,
// the fix — so the error page tells the reader what actually happened.
export async function apiFetch(
  url: string,
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    if (err instanceof TypeError) {
      const hint =
        process.env.NODE_ENV === 'development'
          ? ' — is the API server running? `pnpm dev` starts web + API together.'
          : '.'
      throw new Error(`Cannot reach the API at ${new URL(url).origin}${hint}`, { cause: err })
    }
    throw err
  }
}

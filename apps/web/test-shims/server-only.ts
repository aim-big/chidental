// Test shim for the `server-only` package. In a real Next.js build `server-only`
// throws if a Server-only module is pulled into a Client bundle (our compile-time
// guard on the service-role client). Under vitest there is no RSC boundary, so we
// alias it to this no-op to let server modules be imported directly in unit tests.
export {}

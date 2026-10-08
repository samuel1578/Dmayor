import { defineConfig } from 'vitest/config';

// Focused unit tests for the client-safe payment logic (src) and the pure
// server-side Edge Function modules (supabase/functions/_shared). These are
// deterministic functions — eligibility, reference parsing, error mapping, the
// single-flight guard, HMAC signature verification, webhook parsing/idempotency,
// the verify-and-finalize decision core and the reconcile guard — so the node
// environment is sufficient. No DOM, no database and no real Paystack calls.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
  },
});

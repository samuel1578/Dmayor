import { defineConfig } from 'vitest/config';

// Focused unit tests for the client-safe payment logic. These are pure
// functions (eligibility, callback reference extraction, error mapping, the
// single-flight guard and the Edge Function request bodies), so the node
// environment is sufficient — no DOM, no real Paystack calls.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

/**
 * Server-side generation of Paystack references and the callback URL.
 *
 * References are generated ONLY here (server-side). They are never derived from
 * a bare order number, never browser-generated and never user-supplied. Every
 * initialization gets a fresh reference; a failed/abandoned reference is never
 * reused for a new attempt.
 *
 * Shape: `TPSPAY-<orderNumber>-<32 hex chars>` — unique, immutable per attempt,
 * safe for Paystack (alphanumerics and hyphens only) and not guessable.
 */

import { requireEnv } from './env.ts';

/** A collision-resistant, Paystack-safe reference for one attempt. */
export function buildReference(orderNumber: string): string {
  const safeOrderNumber = orderNumber.replace(/[^A-Za-z0-9-]/g, '-');
  const token = crypto.randomUUID().replace(/-/g, '');
  return `TPSPAY-${safeOrderNumber}-${token}`;
}

/**
 * The Paystack callback URL, built from SITE_URL. Throws ConfigError when
 * SITE_URL is not configured (mapped to `server_configuration_error`). Never
 * hardcodes localhost.
 */
export function buildCallbackUrl(): string {
  const siteUrl = requireEnv('SITE_URL').replace(/\/+$/, '');
  return `${siteUrl}/payment/callback`;
}

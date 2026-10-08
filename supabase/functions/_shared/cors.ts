/**
 * CORS for the F1 Edge Functions.
 *
 * These endpoints are authenticated (Authorization bearer token), so the
 * production wildcard `*` is deliberately NOT used. Only the known storefront
 * origin, the configured SITE_URL origin, and local development origins are
 * echoed back. An unknown origin simply receives no Access-Control-Allow-Origin
 * header, so the browser blocks the response — the server still authenticates
 * and authorizes every request on its own.
 */

import { optionalEnv } from './env.ts';

const STATIC_ALLOWED_ORIGINS: readonly string[] = ['https://theproxyshop.vercel.app'];

const LOCAL_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function siteOrigin(): string | null {
  const siteUrl = optionalEnv('SITE_URL');
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).origin;
  } catch {
    return null;
  }
}

/** The origin to echo back, or null when the caller's origin is not allowed. */
export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (STATIC_ALLOWED_ORIGINS.includes(origin)) return origin;
  if (LOCAL_ORIGIN_PATTERN.test(origin)) return origin;

  const configured = siteOrigin();
  if (configured && origin === configured) return origin;

  return null;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };

  const allowed = allowedOrigin(origin);
  if (allowed) {
    headers['Access-Control-Allow-Origin'] = allowed;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/** A 204 preflight response carrying the CORS headers. */
export function preflightResponse(cors: Record<string, string>): Response {
  return new Response(null, { status: 204, headers: cors });
}

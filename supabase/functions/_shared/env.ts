/**
 * Server-side environment access for the F1 Edge Functions.
 *
 * Nothing in this file is ever bundled into the client. These values come from
 * the Supabase Edge Function secret store / automatic runtime injection:
 *   PAYSTACK_SECRET_KEY  — secret; never leaves the server
 *   SITE_URL             — used to build the Paystack callback URL
 *   SUPABASE_URL         — injected by the Supabase runtime
 *   SUPABASE_ANON_KEY    — injected by the Supabase runtime
 *   SUPABASE_SERVICE_ROLE_KEY — injected by the Supabase runtime; server only
 */

/** Thrown when a required server value is missing so callers can map it to a clear error. */
export class ConfigError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(`Missing required server configuration: ${key}`);
    this.name = 'ConfigError';
    this.key = key;
  }
}

function read(name: string): string | null {
  const value = Deno.env.get(name);
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** A required value, or a ConfigError that maps to `server_configuration_error`. */
export function requireEnv(name: string): string {
  const value = read(name);
  if (value === null) throw new ConfigError(name);
  return value;
}

/** An optional value. */
export function optionalEnv(name: string): string | null {
  return read(name);
}

export function getSupabaseUrl(): string {
  return requireEnv('SUPABASE_URL');
}

/** The public anon key, tolerating both the classic and newer secret names. */
export function getSupabaseAnonKey(): string {
  return (
    optionalEnv('SUPABASE_ANON_KEY') ??
    optionalEnv('SUPABASE_PUBLISHABLE_KEY') ??
    (() => {
      throw new ConfigError('SUPABASE_ANON_KEY');
    })()
  );
}

/** The service-role key. Server only — never returned to a caller. */
export function getServiceRoleKey(): string {
  return (
    optionalEnv('SUPABASE_SERVICE_ROLE_KEY') ??
    optionalEnv('SUPABASE_SECRET_KEY') ??
    (() => {
      throw new ConfigError('SUPABASE_SERVICE_ROLE_KEY');
    })()
  );
}

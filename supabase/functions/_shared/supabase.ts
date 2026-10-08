/**
 * Supabase clients for the F1 Edge Functions.
 *
 * - createUserClient(req) resolves the CALLER from the Authorization bearer
 *   token. It is the only source of caller identity — a user id in the request
 *   body is never trusted.
 * - createServiceClient() is a server-only privileged client used for the
 *   payment_attempts writes and the record_paystack_payment RPC. The service
 *   role is NOT authorization by itself: callers must be authenticated and
 *   proved to own the order BEFORE any privileged write.
 */

import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { getSupabaseAnonKey, getSupabaseUrl, getServiceRoleKey } from './env.ts';

export function createUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') ?? '';

  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The authenticated caller, or null when the bearer token is missing/invalid. */
export async function requireAuthenticatedUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null;

  const client = createUserClient(req);
  const { data, error } = await client.auth.getUser();
  if (error) return null;

  return data.user ?? null;
}

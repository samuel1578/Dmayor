/**
 * Maps Supabase / PostgreSQL errors to concise, human-readable UI copy.
 * Never surfaces SQL internals, credentials or stack traces to the Admin UI.
 */

interface PostgrestishError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

function asError(err: unknown): PostgrestishError {
  if (err && typeof err === 'object') return err as PostgrestishError;
  if (typeof err === 'string') return { message: err };
  return {};
}

export function describeMutationError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const error = asError(err);
  const code = error.code ?? '';
  const raw = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();

  if (code === '23505' || raw.includes('duplicate key')) {
    if (raw.includes('slug')) return 'That slug is already in use. Choose a different one.';
    if (raw.includes('sku')) return 'That SKU is already in use by another product or variant.';
    if (raw.includes('name')) return 'That name is already in use. Choose a different one.';
    return 'One of these values already exists. Please adjust it and try again.';
  }

  if (code === '23514') {
    return 'One of the values is out of the allowed range. Check the price and stock values.';
  }

  if (code === '23503' || raw.includes('foreign key')) {
    return 'A linked record no longer exists. Refresh the page and try again.';
  }

  if (code === '42501' || raw.includes('row-level security') || raw.includes('permission denied')) {
    return 'You do not have permission to change catalogue data.';
  }

  if (code.toUpperCase() === 'PGRST301' || raw.includes('jwt') || raw.includes('token is expired')) {
    return 'Your session has expired. Please sign in again.';
  }

  if (raw.includes('failed to fetch') || raw.includes('network')) {
    return 'Network error. Check your connection and try again.';
  }

  console.error('Catalogue request failed:', error.message ?? err);
  return fallback;
}

/**
 * Error copy for any thrown value: Supabase/PostgREST errors are mapped, our
 * own validation Errors keep their message (they are already user-facing).
 */
export function describeError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'code' in (err as Record<string, unknown>)) {
    return describeMutationError(err, fallback);
  }
  if (err instanceof Error && err.message) return err.message;
  return describeMutationError(err, fallback);
}

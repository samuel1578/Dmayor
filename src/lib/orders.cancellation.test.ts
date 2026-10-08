import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ORDER_STATUS_TRANSITIONS,
  TERMINAL_ORDER_STATUSES,
  adminOrderErrorMessage,
  cancelAdminOrder,
  nextOrderStatuses,
} from './admin/orders';

/**
 * Phase G2 — cancellation + exactly-once stock restoration.
 *
 * Covers all 15 required cases. The database guarantees are asserted directly
 * against migration 014 (the RPC body, its lock/eligibility order, the restock
 * statements, the marker guard, the constraints and the grants) because
 * migrations are applied manually and are never executed in this environment.
 * The client assertions run against a mocked Supabase module — no network, no
 * browser, no database.
 */

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: vi.fn(),
  },
}));

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'supabase/migrations/014_order_cancellation_stock_lifecycle.sql',
);
const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');

/**
 * The admin_cancel_order definition from CREATE to body end, with full-line
 * SQL comments stripped so assertions read executable code only (the header
 * comments deliberately mention domains that are NOT touched).
 */
function cancelFunctionBody(): string {
  const start = migrationSql.indexOf('create or replace function public.admin_cancel_order');
  expect(start).toBeGreaterThan(-1);
  const end = migrationSql.indexOf('end $$;', start);
  expect(end).toBeGreaterThan(start);
  return migrationSql
    .slice(start, end)
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
}

/** Statuses for which the RPC performs an automatic restock. */
function restockStatuses(): string[] {
  const body = cancelFunctionBody();
  const match = body.match(/v_do_restock\s*:=\s*v_status\s+in\s+\(([^)]+)\)/);
  expect(match).not.toBeNull();
  const group = match ? String(match[1]) : '';
  return Array.from(group.matchAll(/'([a-z_]+)'/g), (entry) => String(entry[1]));
}

beforeEach(() => {
  rpcMock.mockReset();
});

describe('auto-restock eligibility', () => {
  it('1. cancelling a pending order restores stock', () => {
    expect(restockStatuses()).toContain('pending');
  });

  it('2. cancelling a confirmed order restores stock', () => {
    expect(restockStatuses()).toContain('confirmed');
  });

  it('3. cancelling a processing order restores stock', () => {
    expect(restockStatuses()).toContain('processing');
    // Exactly these three — nothing more, nothing less.
    expect(restockStatuses().sort()).toEqual(['confirmed', 'pending', 'processing']);
  });

  it('8. shipped cancellation is allowed but never auto-restocks', () => {
    // The body contains no shipped branch at all: shipped is not rejected
    // (009 semantics unchanged — it falls through to the cancel) and it is
    // deliberately absent from the restock eligibility set.
    const body = cancelFunctionBody();
    expect(restockStatuses()).not.toContain('shipped');
    expect(body).not.toContain("'shipped'");
    expect(body).not.toMatch(/shipped/);
  });
});

describe('exactly-once restock', () => {
  it('4. a repeat cancellation cannot restore stock twice', () => {
    const body = cancelFunctionBody();

    // A second call hits the terminal-state rejection before any stock update.
    expect(body).toContain("raise exception 'no_change|This order is already cancelled.'");
    const rejectAt = body.indexOf('no_change');
    const eligibilityAt = body.indexOf('v_do_restock :=');
    const restockAt = body.indexOf('update public.product_variants');
    expect(rejectAt).toBeGreaterThan(-1);
    expect(eligibilityAt).toBeGreaterThan(rejectAt);
    expect(restockAt).toBeGreaterThan(eligibilityAt);

    // The marker itself can only ever be stamped onto an un-restocked order.
    expect(body).toMatch(/set restocked_at = now\(\)[\s\S]{0,160}?and restocked_at is null/);
  });

  it('5. concurrent invocations serialise on a row lock (idempotent)', () => {
    const body = cancelFunctionBody();
    const lockAt = body.indexOf('for update');
    const decisionAt = body.indexOf('v_do_restock :=');
    const terminalRejectAt = body.indexOf("raise exception 'no_change");

    expect(lockAt).toBeGreaterThan(-1);
    // The lock is taken before every decision, so a second admin sees the
    // first admin's committed `cancelled` status and stops.
    expect(decisionAt).toBeGreaterThan(lockAt);
    expect(terminalRejectAt).toBeGreaterThan(lockAt);
    expect(terminalRejectAt).toBeLessThan(decisionAt);
    // Restock eligibility also requires the marker to be unset.
    expect(restockStatuses().length).toBeGreaterThan(0);
    expect(body).toMatch(/v_restocked_at is null/);
  });

  it('15. restocked_at is stamped only once', () => {
    const body = cancelFunctionBody();
    expect(body).toMatch(
      /update public\.orders\s+set restocked_at = now\(\)\s+where id = p_order_id\s+and restocked_at is null/,
    );
    // And a stamped marker implies the order really is cancelled.
    expect(migrationSql).toContain('orders_restocked_requires_cancelled_check');
    expect(migrationSql).toMatch(
      /check \(restocked_at is null or status = 'cancelled'\)/,
    );
  });
});

describe('cancellation transitions', () => {
  it('6. cancelled is terminal — repeat calls and further transitions are rejected', () => {
    expect(cancelFunctionBody()).toContain(
      "raise exception 'no_change|This order is already cancelled.'",
    );
    expect(ORDER_STATUS_TRANSITIONS.cancelled).toEqual([]);
    expect(TERMINAL_ORDER_STATUSES).toContain('cancelled');
    expect(nextOrderStatuses('cancelled')).toEqual([]);
  });

  it('7. a delivered order cannot be cancelled', () => {
    const body = cancelFunctionBody();
    expect(body).toContain(
      "raise exception 'terminal_status|A delivered order is in a final state and cannot be cancelled.'",
    );
    expect(restockStatuses()).not.toContain('delivered');
    expect(nextOrderStatuses('delivered')).toEqual([]);
  });
});

describe('payment stays untouched', () => {
  it('9. cancelling a paid order does not mark it refunded', () => {
    const body = cancelFunctionBody();
    expect(body).not.toContain('payment_status');
    expect(body).not.toMatch(/\bpaid_at\b/);
    expect(body).not.toContain('admin_set_manual_payment');
    expect(body).not.toContain('refunded');
  });

  it('9b. the client cancel path calls only the cancellation RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await cancelAdminOrder('order-1', { reason: 'customer_request', note: '' });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('admin_cancel_order', {
      p_order_id: 'order-1',
      p_reason: 'customer_request',
      p_note: null,
    });
    expect(rpcMock.mock.calls.every((call) => call[0] === 'admin_cancel_order')).toBe(true);
  });

  it('10. an unpaid cancellation leaves payment unchanged (no payment params)', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await cancelAdminOrder('order-2', {
      reason: '  duplicate_order  ',
      note: '  Placed twice by mistake.  ',
    });

    const call = rpcMock.mock.calls[0];
    expect(String(call?.[0])).toBe('admin_cancel_order');
    expect(Object.keys((call?.[1] ?? {}) as Record<string, unknown>).sort()).toEqual([
      'p_note',
      'p_order_id',
      'p_reason',
    ]);
    expect((call?.[1] as Record<string, unknown>).p_reason).toBe('duplicate_order');
    expect((call?.[1] as Record<string, unknown>).p_note).toBe('Placed twice by mistake.');
  });
});

describe('stock restoration', () => {
  it('11. variant stock is restored through the captured variant_id only', () => {
    const body = cancelFunctionBody();
    const start = body.indexOf('update public.product_variants');
    const end = body.indexOf('update public.products');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const restockBlock = body.slice(start, end);

    expect(restockBlock).toContain('pv.id = agg.variant_id');
    expect(restockBlock).toContain('oi.variant_id is not null');
    expect(restockBlock).toContain('sum(oi.quantity)');
    // Never reconstructed from snapshot text.
    expect(restockBlock).not.toMatch(/\bsize\b/);
    expect(restockBlock).not.toMatch(/\bcolour\b/);
    expect(restockBlock).not.toMatch(/\bsku\b/);
  });

  it('12. legacy products.stock is synchronized with the checkout strategy', () => {
    const body = cancelFunctionBody();
    expect(body).toContain('update public.products p');
    expect(body).toMatch(/sum\(v\.stock\)::integer/);
    expect(body).toContain('and v.active');
    // Same coalesce-to-zero re-derivation as create_order_from_cart() step 13.
    expect(body).toMatch(/set stock = coalesce\(/);
  });

  it('11b. clients cannot restock — there is no stock write path in the app', () => {
    const accountSource = readFileSync(
      path.resolve(process.cwd(), 'src/lib/account/orders.ts'),
      'utf8',
    );
    expect(accountSource).not.toMatch(/\.(insert|update|upsert|delete)\s*\(/);
    expect(migrationSql).not.toMatch(/grant\s+(insert|update|delete)/i);
    expect(migrationSql).toContain(
      'revoke all on function public.admin_cancel_order(uuid, text, text) from public;',
    );
    expect(migrationSql).toContain(
      'grant execute on function public.admin_cancel_order(uuid, text, text) to authenticated;',
    );
  });
});

describe('reason handling', () => {
  it('13. the cancellation reason is stored as a constrained code', () => {
    const body = cancelFunctionBody();
    expect(body).toContain('cancellation_reason = v_reason');
    expect(body).toContain('A cancellation reason is required.');

    const constraintAt = migrationSql.indexOf('orders_cancellation_reason_check');
    expect(constraintAt).toBeGreaterThan(-1);
    const constraintBlock = migrationSql.slice(
      constraintAt,
      migrationSql.indexOf(');', constraintAt),
    );
    for (const code of [
      'customer_request',
      'item_unavailable',
      'duplicate_order',
      'payment_issue',
      'operational_issue',
      'other',
    ]) {
      expect(constraintBlock).toContain(`'${code}'`);
    }
  });

  it('13b. invalid or missing reasons are rejected before any write', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(
      cancelAdminOrder('order-3', { reason: '', note: '' }),
    ).rejects.toThrow('Choose a cancellation reason.');
    await expect(
      cancelAdminOrder('order-3', { reason: 'not_a_reason', note: '' }),
    ).rejects.toThrow('Choose a cancellation reason from the list.');
    await expect(
      cancelAdminOrder('order-3', { reason: 'other', note: 'x'.repeat(501) }),
    ).rejects.toThrow('500 characters or fewer.');
    // Nothing reached the database.
    expect(rpcMock).not.toHaveBeenCalled();

    // A non-admin is rejected by the database (fail-closed gate).
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'not_authorized|Admin access is required to cancel an order.' },
    });
    const thrown = await cancelAdminOrder('order-3', {
      reason: 'item_unavailable',
      note: '',
    }).then(
      () => null,
      (err: unknown) => err,
    );
    expect(thrown).not.toBeNull();
    expect(adminOrderErrorMessage(thrown)).toBe(
      'Admin access is required to cancel an order.',
    );
  });
});

describe('customer visibility', () => {
  it('14. the internal note, actor and restock marker are never selected for customers', () => {
    const accountSource = readFileSync(
      path.resolve(process.cwd(), 'src/lib/account/orders.ts'),
      'utf8',
    );
    // The customer query DOES carry the date and the reason code…
    expect(accountSource).toContain('cancelled_at, cancellation_reason');
    // …and deliberately NOT the internal fields.
    expect(accountSource).not.toContain('cancellation_note');
    expect(accountSource).not.toContain('cancelled_by');
    expect(accountSource).not.toContain('restocked_at');
  });

  it('14b. a repeat cancellation surfaces the terminal-state message', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'no_change|This order is already cancelled.' },
    });

    const thrown = await cancelAdminOrder('order-4', {
      reason: 'customer_request',
      note: '',
    }).then(
      () => null,
      (err: unknown) => err,
    );
    expect(thrown).not.toBeNull();
    expect(adminOrderErrorMessage(thrown)).toBe('This order is already cancelled.');
  });
});

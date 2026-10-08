import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminOrderErrorMessage, setAdminOrderShipment } from './admin/orders';
import { getMyOrder } from './account/orders';

/**
 * Phase G1 — shipment save path and customer read path.
 *
 * Covers required tests 1 (admin can save tracking), 2 (non-admin cannot save
 * tracking), 3 (saving does not change order status), 4 (saving does not
 * change payment status), 7 (customer sees tracking on their own order) and
 * 8 (customer cannot mutate tracking).
 *
 * The database guarantees are asserted directly against migration 013 — the
 * RPC body, its fail-closed gate, the exact column list it assigns and the
 * grants it issues — because migrations are applied manually and are never
 * executed in this environment. The client tests run against a mocked
 * Supabase module; no network, no browser, no database.
 */

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: fromMock,
  },
}));

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'supabase/migrations/013_order_tracking_foundation.sql',
);
const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');

/**
 * The admin_set_order_shipment definition, from CREATE to its body end,
 * with full-line SQL comments removed so assertions read executable code only
 * (the explanatory comments deliberately mention the domains that are NOT
 * touched).
 */
function shipmentFunctionBody(): string {
  const start = migrationSql.indexOf(
    'create or replace function public.admin_set_order_shipment',
  );
  expect(start).toBeGreaterThan(-1);
  const end = migrationSql.indexOf('end $$;', start);
  expect(end).toBeGreaterThan(start);
  return migrationSql
    .slice(start, end)
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');
}

/** The exact columns the RPC's UPDATE assigns (one per line in the file). */
function shipmentUpdateColumns(): string[] {
  const body = shipmentFunctionBody();
  const updateStart = body.indexOf('update public.orders');
  expect(updateStart).toBeGreaterThan(-1);
  const setStart = body.indexOf('set', updateStart);
  const whereStart = body.indexOf('where id = p_order_id', setStart);
  expect(setStart).toBeGreaterThan(-1);
  expect(whereStart).toBeGreaterThan(setStart);

  const setBlock = body.slice(setStart + 'set'.length, whereStart);
  return Array.from(setBlock.matchAll(/^\s*([a-z_]+)\s*=/gm), (match) => String(match[1]));
}

/** Wires the mocked `from('orders')` chain used by getMyOrder. */
function mockOrderQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eqNumber = vi.fn(() => ({ maybeSingle }));
  const eqUser = vi.fn(() => ({ eq: eqNumber }));
  const select = vi.fn(() => ({ eq: eqUser }));
  fromMock.mockReturnValue({ select });
  // The chain is called as select(query).eq(userId).eq(orderNumber).maybeSingle()
  // — widen the recorded calls so the query text and filters stay assertable.
  const calls = {
    select: select.mock.calls as unknown as [string][],
    eqUser: eqUser.mock.calls as unknown as [string, string][],
    eqNumber: eqNumber.mock.calls as unknown as [string, string][],
  };
  return { select, eqUser, eqNumber, maybeSingle, calls };
}

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe('admin shipment save', () => {
  it('1. Admin can save tracking — trimmed values go to the dedicated RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await setAdminOrderShipment('order-1', {
      carrier: '  DHL  ',
      trackingNumber: '  JD0002123  ',
      trackingUrl: '  https://track.example.com/JD0002123  ',
      deliveryNote: '  Leave at the front desk.  ',
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('admin_set_order_shipment', {
      p_order_id: 'order-1',
      p_carrier: 'DHL',
      p_tracking_number: 'JD0002123',
      p_tracking_url: 'https://track.example.com/JD0002123',
      p_delivery_note: 'Leave at the front desk.',
    });
  });

  it('1b. saving supports clearing a previously saved field', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await setAdminOrderShipment('order-1', { carrier: '   ', trackingNumber: '' });

    expect(rpcMock).toHaveBeenCalledWith('admin_set_order_shipment', {
      p_order_id: 'order-1',
      p_carrier: null,
      p_tracking_number: null,
      p_tracking_url: null,
      p_delivery_note: null,
    });
  });

  it('2. non-admin cannot save tracking — the database error surfaces as readable copy', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'not_authorized|Admin access is required to save shipment details.' },
    });

    const thrown = await setAdminOrderShipment('order-1', { carrier: 'DHL' }).then(
      () => null,
      (err: unknown) => err,
    );

    expect(thrown).not.toBeNull();
    expect(adminOrderErrorMessage(thrown)).toBe(
      'Admin access is required to save shipment details.',
    );
  });

  it('2b. the RPC fails closed unless public.is_admin(), before any write', () => {
    const body = shipmentFunctionBody();
    const gate = body.indexOf('if not coalesce(public.is_admin(), false) then');
    const write = body.indexOf('update public.orders');

    expect(gate).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(gate);
    expect(body).toContain("raise exception 'not_authorized|");
  });

  it('2c. the invalid-URL error code maps to its human sentence', () => {
    expect(
      adminOrderErrorMessage({
        message:
          'invalid_shipment|Tracking link must be a valid http:// or https:// address.',
      }),
    ).toBe('Tracking link must be a valid http:// or https:// address.');
  });

  it('3. saving tracking does not change order status', () => {
    // The UPDATE assigns exactly the shipment columns — nothing else.
    expect(shipmentUpdateColumns().sort()).toEqual([
      'carrier',
      'delivery_note',
      'tracking_number',
      'tracking_updated_at',
      'tracking_url',
    ]);

    const body = shipmentFunctionBody();
    expect(body).not.toContain('status =');
    expect(body).not.toMatch(/\bshipped_at\b/);
    expect(body).not.toMatch(/\bdelivered_at\b/);
    expect(body).not.toMatch(/\bconfirmed_at\b/);
    expect(body).not.toMatch(/\bcancelled_at\b/);
    // Stock is never touched either.
    expect(body).not.toMatch(/\bstock\b/);
  });

  it('4. saving tracking does not change payment status', () => {
    const body = shipmentFunctionBody();
    expect(shipmentUpdateColumns()).not.toContain('payment_status');
    expect(body).not.toContain('payment_status');
    expect(body).not.toMatch(/\bpaid_at\b/);
    expect(body).not.toContain('admin_set_manual_payment');
  });

  it('4b. the migration adds only nullable shipment columns to orders', () => {
    expect(migrationSql).toMatch(
      /alter table public\.orders add column if not exists carrier text;/,
    );
    expect(migrationSql).toMatch(
      /alter table public\.orders add column if not exists tracking_number text;/,
    );
    expect(migrationSql).toMatch(
      /alter table public\.orders add column if not exists tracking_url text;/,
    );
    expect(migrationSql).toMatch(
      /alter table public\.orders add column if not exists delivery_note text;/,
    );
    // No payment or stock column is added, dropped or altered here.
    expect(migrationSql).not.toMatch(/add column if not exists payment_/);
    expect(migrationSql).not.toMatch(/drop column/i);
  });
});

describe('customer tracking access', () => {
  it('7. customer sees tracking on their own order', async () => {
    const query = mockOrderQuery({
      data: {
        id: 'order-1',
        order_number: 'TPS-2026-000001',
        status: 'shipped',
        payment_status: 'paid',
        subtotal: 100,
        shipping_amount: 0,
        tax_amount: 0,
        total_amount: 100,
        currency: 'GHS',
        recipient_name: 'Ama',
        phone: '0200000000',
        address_line1: '1 Oxford Street',
        city: 'Accra',
        country: 'Ghana',
        created_at: '2026-10-08T10:00:00Z',
        updated_at: '2026-10-08T10:00:00Z',
        carrier: 'DHL',
        tracking_number: 'JD0002123456',
        tracking_url: 'https://track.dhl.com/JD0002123456',
        delivery_note: 'Leave at the front desk.',
        order_items: [],
      },
      error: null,
    });

    const detail = await getMyOrder('user-1', 'TPS-2026-000001');

    expect(detail).not.toBeNull();
    expect(detail?.status).toBe('shipped');
    expect(detail?.carrier).toBe('DHL');
    expect(detail?.trackingNumber).toBe('JD0002123456');
    expect(detail?.trackingUrl).toBe('https://track.dhl.com/JD0002123456');
    expect(detail?.deliveryNote).toBe('Leave at the front desk.');

    // The query selects the shipment columns and is scoped to the caller.
    const selectArgs = query.calls.select[0]?.[0] ?? '';
    expect(selectArgs).toContain('carrier');
    expect(selectArgs).toContain('tracking_number');
    expect(selectArgs).toContain('tracking_url');
    expect(selectArgs).toContain('delivery_note');
    expect(query.calls.eqUser[0]).toEqual(['user_id', 'user-1']);
    expect(query.calls.eqNumber[0]).toEqual(['order_number', 'TPS-2026-000001']);
  });

  it('7b. an order without tracking maps to null cleanly', async () => {
    mockOrderQuery({
      data: {
        id: 'order-2',
        order_number: 'TPS-2026-000002',
        status: 'pending',
        payment_status: 'unpaid',
        subtotal: 0,
        shipping_amount: 0,
        tax_amount: 0,
        total_amount: 0,
        currency: 'GHS',
        recipient_name: 'Kojo',
        phone: '0200000001',
        address_line1: '2 Oxford Street',
        city: 'Accra',
        country: 'Ghana',
        created_at: '2026-10-08T10:00:00Z',
        updated_at: '2026-10-08T10:00:00Z',
        carrier: null,
        tracking_number: null,
        tracking_url: null,
        delivery_note: null,
        order_items: [],
      },
      error: null,
    });

    const detail = await getMyOrder('user-2', 'TPS-2026-000002');

    expect(detail?.carrier).toBeNull();
    expect(detail?.trackingNumber).toBeNull();
    expect(detail?.trackingUrl).toBeNull();
    expect(detail?.deliveryNote).toBeNull();
  });

  it('8. customer cannot mutate tracking', () => {
    // 1. The customer data layer exposes no write path of any kind.
    const accountSource = readFileSync(
      path.resolve(process.cwd(), 'src/lib/account/orders.ts'),
      'utf8',
    );
    expect(accountSource).not.toMatch(/\.(insert|update|upsert|delete)\s*\(/);
    expect(accountSource).not.toContain('admin_set_order_shipment');

    // 2. The migration issues no new write privilege on orders to anyone.
    expect(migrationSql).not.toMatch(/grant\s+(insert|update|delete)/i);

    // 3. The shipment RPC is executable by authenticated sessions only.
    expect(migrationSql).toContain(
      'revoke all on function public.admin_set_order_shipment(uuid, text, text, text, text) from public;',
    );
    expect(migrationSql).toContain(
      'revoke all on function public.admin_set_order_shipment(uuid, text, text, text, text) from anon;',
    );
    expect(migrationSql).toContain(
      'grant execute on function public.admin_set_order_shipment(uuid, text, text, text, text) to authenticated;',
    );

    // 4. Customer order reads still go through the existing ownership policy.
    const ordersPolicySql = readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/008_orders_checkout_foundation.sql'),
      'utf8',
    );
    expect(ordersPolicySql).toContain('revoke insert, update, delete on public.orders from authenticated;');
    expect(ordersPolicySql).toMatch(
      /create policy "Customers can read own orders"[\s\S]*?for select/,
    );
  });
});

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CUSTOMER_STATUS_LABELS,
  FULFILMENT_STEPS,
  ORDER_STATUS_ACTION_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAYMENT_STATUS_LABELS,
  TERMINAL_ORDER_STATUSES,
  customerStatusLabel,
  orderStatusActionLabel,
  paymentSummaryLabel,
} from './orders/status';
import {
  ORDER_STATUS_TRANSITIONS,
  isTerminalOrderStatus,
  nextOrderStatuses,
  setAdminOrderStatus,
} from './admin/orders';
import { TRACKING_MISSING_WARNING, showTrackingFor } from './shipment';
import type { OrderStatus } from './supabase';

/**
 * Phase G3 — fulfilment UX & operational polish.
 *
 * Covers the 10 required cases. Migrations are applied manually and never run
 * here, so the transition rules are asserted directly against migration 009
 * (the exact SQL lines the UI must mirror); everything else is asserted
 * against the pure wording/status module and against source files, in the same
 * static style as `orders.cancellation.test.ts`.
 */

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: {
    rpc: rpcMock,
    from: vi.fn(),
  },
}));

const ROOT = process.cwd();

function read(relative: string): string {
  return readFileSync(path.resolve(ROOT, relative), 'utf8');
}

/** Every .ts/.tsx file under a directory, recursively. */
function sourceFilesUnder(relativeDir: string): string[] {
  const dir = path.resolve(ROOT, relativeDir);
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/** Files that render customer-facing wording. */
const CUSTOMER_SURFACES = [
  'src/pages/account/AccountOrders.tsx',
  'src/pages/account/AccountOverview.tsx',
  'src/pages/account/AccountOrderDetail.tsx',
  'src/pages/account/AccountPaymentDetail.tsx',
  'src/components/account/OrderStatusTimeline.tsx',
  'src/components/account/OrderDetailView.tsx',
  'src/lib/orders/invoice.ts',
];

beforeEach(() => {
  rpcMock.mockReset();
});

/* -------------------------------------------------------------------------- */
/* 1 — one state model                                                        */
/* -------------------------------------------------------------------------- */

describe('canonical status model', () => {
  it('1. exactly six fulfilment statuses exist; packed/dispatched/out_for_delivery appear nowhere', () => {
    expect([...ORDER_STATUSES]).toEqual([
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
    ]);
    expect([...TERMINAL_ORDER_STATUSES]).toEqual(['delivered', 'cancelled']);
    expect([...FULFILMENT_STEPS]).toEqual([
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
    ]);

    const banned = /\bpacked\b|\bdispatched\b|out_for_delivery|out for delivery/i;
    const offenders = sourceFilesUnder('src')
      .filter((file) => !file.endsWith('.test.ts'))
      .filter((file) => banned.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('1b. both vocabularies cover every status and no other key', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
      expect(CUSTOMER_STATUS_LABELS[status]).toBeTruthy();
    }
    expect(Object.keys(ORDER_STATUS_LABELS).sort()).toEqual([...ORDER_STATUSES].sort());
    expect(Object.keys(CUSTOMER_STATUS_LABELS).sort()).toEqual([...ORDER_STATUSES].sort());
  });
});

/* -------------------------------------------------------------------------- */
/* 2 — customer wording                                                       */
/* -------------------------------------------------------------------------- */

describe('customer wording', () => {
  it('2. the required customer sentences are used verbatim for all six statuses', () => {
    expect(CUSTOMER_STATUS_LABELS).toEqual({
      pending: 'Order received',
      confirmed: 'Order confirmed',
      processing: 'Preparing your order',
      shipped: 'Order shipped',
      delivered: 'Delivered',
      cancelled: 'Order cancelled',
    });
    for (const status of ORDER_STATUSES) {
      expect(customerStatusLabel(status)).toBe(CUSTOMER_STATUS_LABELS[status]);
    }
  });

  it('2b. shopper-visible surfaces read wording from the shared helper', () => {
    for (const file of CUSTOMER_SURFACES) {
      expect(read(file), file).not.toContain('ORDER_STATUS_LABELS');
    }
    for (const file of [
      'src/pages/account/AccountOrders.tsx',
      'src/pages/account/AccountOverview.tsx',
      'src/pages/account/AccountPaymentDetail.tsx',
      'src/components/account/OrderStatusTimeline.tsx',
      'src/lib/orders/invoice.ts',
    ]) {
      expect(read(file), file).toContain('customerStatusLabel(');
    }
    // The timeline carries the current stage to assistive tech explicitly.
    const timeline = read('src/components/account/OrderStatusTimeline.tsx');
    expect(timeline).toContain('aria-current');
  });
});

/* -------------------------------------------------------------------------- */
/* 3 — admin wording + action labels                                          */
/* -------------------------------------------------------------------------- */

describe('admin wording', () => {
  it('3. transition buttons use the shared action labels, never re-invented text', () => {
    expect(orderStatusActionLabel('confirmed')).toBe('Confirm order');
    expect(orderStatusActionLabel('processing')).toBe('Start processing');
    expect(orderStatusActionLabel('shipped')).toBe('Mark shipped');
    expect(orderStatusActionLabel('delivered')).toBe('Mark delivered');
    expect(orderStatusActionLabel('cancelled')).toBe('Cancel order…');
    // Actions only exist for real transition targets…
    expect(Object.keys(ORDER_STATUS_ACTION_LABELS).sort()).toEqual([
      'cancelled',
      'confirmed',
      'delivered',
      'processing',
      'shipped',
    ]);
    // …and an unreachable status never produces a clickable label.
    expect(ORDER_STATUS_ACTION_LABELS.pending).toBeUndefined();

    const detail = read('src/pages/admin/AdminOrderDetail.tsx');
    expect(detail).toContain('orderStatusActionLabel(');
    expect(detail).not.toContain('Mark as ${');
  });
});

/* -------------------------------------------------------------------------- */
/* 4 — transitions mirror migration 009                                       */
/* -------------------------------------------------------------------------- */

describe('allowed transitions', () => {
  const migration = read('supabase/migrations/009_admin_order_operations.sql');

  it('4. the client map matches the database transition block (009, lines 294-297)', () => {
    const blockStart = migration.indexOf('v_allowed := case v_current');
    expect(blockStart).toBeGreaterThan(-1);
    const blockEnd = migration.indexOf('end;', blockStart);
    const block = migration.slice(blockStart, blockEnd);

    const fromDb: Record<string, string[]> = {};
    for (const match of block.matchAll(/when '([a-z_]+)' then array\[([^\]]*)\]/g)) {
      fromDb[match[1]] = Array.from(match[2].matchAll(/'([a-z_]+)'/g), (m) => m[1]);
    }
    expect(fromDb).toEqual({
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered', 'cancelled'],
    });

    for (const [status, targets] of Object.entries(fromDb)) {
      const key = status as OrderStatus;
      expect([...nextOrderStatuses(key)]).toEqual(targets);
      expect([...(ORDER_STATUS_TRANSITIONS[key] ?? [])]).toEqual(targets);
    }
    expect(nextOrderStatuses('delivered')).toEqual([]);
    expect(nextOrderStatuses('cancelled')).toEqual([]);
    expect(isTerminalOrderStatus('delivered')).toBe(true);
    expect(isTerminalOrderStatus('cancelled')).toBe(true);
    expect(isTerminalOrderStatus('processing')).toBe(false);
  });

  it('4b. terminal states are rejected before any write, and shipped may still be cancelled', () => {
    expect(migration).toContain('terminal_status|A % order is in a final state');
    expect(migration).toContain('no_change|This order is already %.');
    expect(ORDER_STATUS_TRANSITIONS.shipped).toEqual(['delivered', 'cancelled']);
  });
});

/* -------------------------------------------------------------------------- */
/* 5 — payment stays a separate domain                                        */
/* -------------------------------------------------------------------------- */

describe('payment vs fulfilment', () => {
  it('5. payment wording never carries fulfilment wording (and vice versa)', () => {
    expect(paymentSummaryLabel('paid', 'paystack')).toBe('Paid · Paystack');
    expect(paymentSummaryLabel('paid', 'manual')).toBe('Paid · Manual');
    // An unpaid order has no source worth naming.
    expect(paymentSummaryLabel('unpaid', 'paystack')).toBe('Unpaid');
    expect(paymentSummaryLabel('unpaid')).toBe('Unpaid');

    const fulfilmentWords = /\b(pending|confirmed|processing|shipped|delivered|cancelled)\b/i;
    const paymentWords = /\b(unpaid|paid|failed|refunded)\b/i;
    for (const label of Object.values(PAYMENT_STATUS_LABELS)) {
      expect(label).not.toMatch(fulfilmentWords);
    }
    for (const label of Object.values(ORDER_STATUS_LABELS)) {
      expect(label).not.toMatch(paymentWords);
    }
    for (const label of Object.values(CUSTOMER_STATUS_LABELS)) {
      expect(label).not.toMatch(paymentWords);
    }
  });

  it('5b. the client status mutation sends only the order id and the status', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    await setAdminOrderStatus('order-1', 'shipped');
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('admin_set_order_status', {
      p_order_id: 'order-1',
      p_status: 'shipped',
    });
    // No payment or tracking parameter is ever part of a status change.
    expect(Object.keys(rpcMock.mock.calls[0][1] as Record<string, unknown>).sort()).toEqual([
      'p_order_id',
      'p_status',
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* 6 — tracking is never a blocker                                             */
/* -------------------------------------------------------------------------- */

describe('tracking without data', () => {
  it('6. the missing-tracking warning is exact, and shipping never requires tracking', () => {
    expect(TRACKING_MISSING_WARNING).toBe('No tracking information has been added.');

    // Transition rules contain no tracking condition of any kind.
    expect(ORDER_STATUS_TRANSITIONS.processing).toContain('shipped');
    const adminDetail = read('src/pages/admin/AdminOrderDetail.tsx');
    expect(adminDetail).toContain('TRACKING_MISSING_WARNING');
    // The warning is imported once, used once in the ship feedback and once in
    // the Fulfilment card — it is never re-typed into a component.
    expect(adminDetail.split('TRACKING_MISSING_WARNING').length - 1).toBe(3);
    // …and it is rendered as a status notice, not as a blocking error.
    const cardAt = adminDetail.lastIndexOf('TRACKING_MISSING_WARNING');
    expect(adminDetail.slice(cardAt - 400, cardAt)).toContain('role="status"');
  });
});

/* -------------------------------------------------------------------------- */
/* 7 — tracking display                                                       */
/* -------------------------------------------------------------------------- */

describe('customer tracking visibility', () => {
  it('7. tracking is hidden until the order is shipped or later', () => {
    expect(showTrackingFor('pending', null)).toBe(false);
    expect(showTrackingFor('confirmed', null)).toBe(false);
    expect(showTrackingFor('processing', null)).toBe(false);
    expect(showTrackingFor('shipped', null)).toBe(true);
    expect(showTrackingFor('delivered', null)).toBe(true);
    expect(showTrackingFor('cancelled', null)).toBe(false);
    // A recorded shipped_at wins over an odd status.
    expect(showTrackingFor('processing', '2026-10-08T10:00:00Z')).toBe(true);
    expect(showTrackingFor('shipped', '')).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* 8/9/10 — single source, de-duplication, required surfaces                  */
/* -------------------------------------------------------------------------- */

describe('one source of wording', () => {
  it('8. no component or page redefines a status/payment label map', () => {
    const files = [
      ...sourceFilesUnder('src/components'),
      ...sourceFilesUnder('src/pages'),
    ];
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      // A local fulfilment label map, or a local copy of the payment labels —
      // explanatory notes (`paid: 'This order has been marked as paid.'`) are
      // prose, not wording, and are allowed.
      return (
        /\b(pending|confirmed|processing|shipped|delivered|cancelled):\s*'/.test(source) ||
        /\b(unpaid|paid|failed|refunded):\s*'(Unpaid|Paid|Failed|Refunded)'/.test(source)
      );
    });
    expect(offenders).toEqual([]);
  });

  it('9. payment and fulfilment are shown as two labelled rows, never merged', () => {
    const list = read('src/pages/admin/AdminOrders.tsx');
    expect(list).toContain('Fulfilment');
    expect(list).toContain('Payment');
    // The queue column header says Fulfilment, not the ambiguous "Status".
    expect(list).not.toContain('>Status<');

    const detail = read('src/pages/admin/AdminOrderDetail.tsx');
    expect(detail).toContain('paymentSummaryLabel(order.paymentStatus, order.paymentSource)');

    const overview = read('src/pages/account/AccountOverview.tsx');
    expect(overview).toContain('Fulfilment: {customerStatusLabel(');
    expect(overview).toContain('Payment: {paymentSummaryLabel(');
  });

  it('10. an invalid route renders a real state instead of a blank screen', () => {
    const notFound = read('src/pages/NotFound.tsx');
    expect(notFound).toContain('Page not found');

    const app = read('src/App.tsx');
    const catchAlls = app.match(/path="\*"/g) ?? [];
    expect(catchAlls.length).toBeGreaterThanOrEqual(2);
    expect(app).toContain('<NotFound />');
  });
});

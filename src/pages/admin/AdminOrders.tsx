import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  adminOrderErrorMessage,
  listAdminOrders,
  type AdminOrderListItem,
} from '../../lib/admin/orders';
import type { OrderPaymentStatus, OrderStatus } from '../../lib/supabase';
import { formatAdminDate, formatCedis } from '../../lib/admin/format';

const PAGE_SIZE = 50;

const ORDER_STATUS_FILTERS: ReadonlyArray<OrderStatus> = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

const PAYMENT_STATUS_FILTERS: ReadonlyArray<OrderPaymentStatus> = [
  'unpaid',
  'paid',
  'failed',
  'refunded',
];

/**
 * Admin order queue (Phase E3) — real orders only.
 *
 * Search and filtering run server-side through `admin_list_orders`, which
 * re-checks `is_admin()` and returns a single paged slice (no N+1, no
 * unbounded fetch). Read-only: every mutation happens on the order detail page.
 */
function statusPillClass(status: OrderStatus): string {
  if (status === 'cancelled') return 'border-ghana-red/60 text-ghana-red';
  if (status === 'delivered') return 'border-ghana-green text-ghana-green';
  return 'border-ghana-black/20 dark:border-white/25 text-ghana-black/70 dark:text-white/70';
}

function paymentPillClass(paymentStatus: OrderPaymentStatus): string {
  if (paymentStatus === 'paid') return 'border-ghana-green text-ghana-green';
  if (paymentStatus === 'failed' || paymentStatus === 'refunded') {
    return 'border-ghana-red/60 text-ghana-red';
  }
  return 'border-ghana-black/20 dark:border-white/25 text-ghana-black/70 dark:text-white/70';
}

export function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentStatus | 'all'>('all');

  // Typing must not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search);
      setLimit(PAGE_SIZE);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const rows = await listAdminOrders({
        search: appliedSearch,
        status: statusFilter,
        paymentStatus: paymentFilter,
        limit,
        offset: 0,
      });
      setOrders(rows);
    } catch (err) {
      console.error('Admin order list failed:', err);
      setLoadError(adminOrderErrorMessage(err, 'Could not load orders.'));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, statusFilter, paymentFilter, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasFilters = appliedSearch.trim().length > 0 || statusFilter !== 'all' || paymentFilter !== 'all';
  const hasMore = orders.length === limit;

  const clearFilters = () => {
    setSearch('');
    setAppliedSearch('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setLimit(PAGE_SIZE);
  };

  const renderOrderLink = (order: AdminOrderListItem, label: string) => (
    <Link
      to={`/admin/orders/${order.id}`}
      className="font-mono text-ghana-black dark:text-white hover:text-ghana-green transition-colors duration-200"
    >
      {label}
    </Link>
  );

  return (
    <div className="max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-3">Operations</p>
          <h1 className="font-display text-4xl sm:text-5xl text-ghana-black dark:text-white">
            Orders
          </h1>
          <p className="mt-3 text-sm text-ghana-black/60 dark:text-white/60">
            Customer orders, newest first. Payment includes verified Paystack transactions and
            manual records; fulfilment is recorded manually.
            {loading && orders.length > 0 ? ' Updating…' : ''}
          </p>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mt-6 text-sm text-ghana-red">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            Try again
          </button>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <label className="relative w-full lg:max-w-sm">
          <span className="sr-only">Search orders</span>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghana-black/40 dark:text-white/40"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order number, customer, email or phone"
            className="input-field pl-9"
          />
        </label>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
              Order status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as OrderStatus | 'all');
                setLimit(PAGE_SIZE);
              }}
              className="input-field py-2.5 pr-8"
            >
              <option value="all">All</option>
              {ORDER_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {ORDER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
              Payment status
            </span>
            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value as OrderPaymentStatus | 'all');
                setLimit(PAGE_SIZE);
              }}
              className="input-field py-2.5 pr-8"
            >
              <option value="all">All</option>
              {PAYMENT_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {PAYMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2.5 rounded-lg border border-ghana-black/15 dark:border-white/20 text-[10px] uppercase tracking-[0.16em] text-ghana-black/70 dark:text-white/70 transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && orders.length === 0 && !loadError && (
        <p className="mt-8 text-sm text-ghana-black/50 dark:text-white/50">Loading orders…</p>
      )}

      {!loading && orders.length === 0 && !loadError && (
        <p className="mt-10 text-sm text-ghana-black/60 dark:text-white/60">
          {hasFilters
            ? 'No orders match these filters.'
            : 'No orders yet. Orders placed by customers will appear here.'}
        </p>
      )}

      {orders.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.16em] text-ghana-black/50 dark:text-white/50">
                  <th className="text-left font-normal pb-3 pr-4">Order</th>
                  <th className="text-left font-normal pb-3 pr-4">Customer</th>
                  <th className="text-left font-normal pb-3 pr-4">Email</th>
                  <th className="text-left font-normal pb-3 pr-4">Date</th>
                  <th className="text-right font-normal pb-3 pr-4">Items</th>
                  <th className="text-right font-normal pb-3 pr-4">Total</th>
                  <th className="text-left font-normal pb-3 pr-4">Payment</th>
                  <th className="text-left font-normal pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t border-ghana-black/10 dark:border-white/10 align-top"
                  >
                    <td className="py-4 pr-4 whitespace-nowrap">
                      {renderOrderLink(order, order.orderNumber)}
                    </td>
                    <td className="py-4 pr-4 text-ghana-black/80 dark:text-white/80">
                      <p className="max-w-[14rem] truncate">{order.customerName}</p>
                      {order.customerPhone && (
                        <p className="text-xs text-ghana-black/50 dark:text-white/50">
                          {order.customerPhone}
                        </p>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-ghana-black/70 dark:text-white/70">
                      <span className="block max-w-[14rem] truncate">
                        {order.customerEmail ?? '—'}
                      </span>
                    </td>
                    <td className="py-4 pr-4 whitespace-nowrap text-ghana-black/70 dark:text-white/70">
                      {formatAdminDate(order.createdAt)}
                    </td>
                    <td className="py-4 pr-4 text-right text-ghana-black/80 dark:text-white/80">
                      {order.itemCount}
                    </td>
                    <td className="py-4 pr-4 text-right text-ghana-black dark:text-white whitespace-nowrap">
                      {formatCedis(order.totalAmount)}
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={`text-[10px] uppercase tracking-[0.14em] border rounded-full px-3 py-1 whitespace-nowrap ${paymentPillClass(
                          order.paymentStatus,
                        )}`}
                      >
                        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </span>
                    </td>
                    <td className="py-4">
                      <span
                        className={`text-[10px] uppercase tracking-[0.14em] border rounded-full px-3 py-1 whitespace-nowrap ${statusPillClass(
                          order.status,
                        )}`}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden mt-8 space-y-4">
            {orders.map((order) => (
              <li
                key={order.id}
                className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    {renderOrderLink(order, order.orderNumber)}
                    <p className="mt-1 text-xs text-ghana-black/55 dark:text-white/55">
                      {formatAdminDate(order.createdAt)} · {order.itemCount} item
                      {order.itemCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p className="font-display text-xl text-ghana-black dark:text-white">
                    {formatCedis(order.totalAmount)}
                  </p>
                </div>

                <div className="mt-3 space-y-1 text-xs text-ghana-black/70 dark:text-white/70">
                  <p className="truncate">{order.customerName}</p>
                  <p className="truncate">{order.customerEmail ?? 'No email on record'}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`text-[10px] uppercase tracking-[0.14em] border rounded-full px-3 py-1 ${statusPillClass(
                      order.status,
                    )}`}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-[0.14em] border rounded-full px-3 py-1 ${paymentPillClass(
                      order.paymentStatus,
                    )}`}
                  >
                    {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <p className="text-xs text-ghana-black/50 dark:text-white/50">
              Showing {orders.length} order{orders.length === 1 ? '' : 's'}
              {hasMore ? '' : ' (end of list)'}
            </p>
            {hasMore && (
              <button
                type="button"
                onClick={() => setLimit((current) => current + PAGE_SIZE)}
                disabled={loading}
                className="px-5 py-2.5 rounded-lg border border-ghana-black/15 dark:border-white/20 text-[10px] uppercase tracking-[0.16em] text-ghana-black dark:text-white transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green disabled:opacity-60"
              >
                {loading ? 'Loading…' : 'Show more'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

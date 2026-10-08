import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  PAYMENT_SOURCE_LABELS,
  PAYMENT_SOURCE_OPTIONS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_OPTIONS,
  adminPaymentErrorMessage,
  listAdminPayments,
  type AdminPaymentListItem,
} from '../../lib/admin/payments';
import type { OrderPaymentStatus, PaymentSource } from '../../lib/supabase';
import { formatAdminDate, formatAdminDateTime, formatCedis } from '../../lib/admin/format';

const PAGE_SIZE = 50;

/**
 * Admin payment queue (Phase H0.1) — real orders only.
 *
 * Read-only: search, payment-status and payment-source filtering run
 * server-side through `admin_list_payments`, which re-checks `is_admin()` and
 * returns a single paged slice (no N+1, no unbounded fetch). Every mutation
 * (manual record, or a server-side Paystack re-check) happens on the payment
 * detail page.
 */
function paymentPillClass(paymentStatus: OrderPaymentStatus): string {
  if (paymentStatus === 'paid') return 'border-ghana-green text-ghana-green';
  if (paymentStatus === 'failed' || paymentStatus === 'refunded') {
    return 'border-ghana-red/60 text-ghana-red';
  }
  return 'border-ghana-black/20 dark:border-white/25 text-ghana-black/70 dark:text-white/70';
}

function sourceLabel(source: PaymentSource | null): string {
  return source ? PAYMENT_SOURCE_LABELS[source] : '—';
}

export function AdminPayments() {
  const [payments, setPayments] = useState<AdminPaymentListItem[]>([]);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<PaymentSource | 'all'>('all');

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
      const rows = await listAdminPayments({
        search: appliedSearch,
        paymentStatus: paymentFilter,
        paymentSource: sourceFilter,
        limit,
        offset: 0,
      });
      setPayments(rows);
    } catch (err) {
      console.error('Admin payment list failed:', err);
      setLoadError(adminPaymentErrorMessage(err, 'Could not load payments.'));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, paymentFilter, sourceFilter, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasFilters =
    appliedSearch.trim().length > 0 || paymentFilter !== 'all' || sourceFilter !== 'all';
  const hasMore = payments.length === limit;

  const clearFilters = () => {
    setSearch('');
    setAppliedSearch('');
    setPaymentFilter('all');
    setSourceFilter('all');
    setLimit(PAGE_SIZE);
  };

  const renderOrderLink = (payment: AdminPaymentListItem, label: string) => (
    <Link
      to={`/admin/payments/${payment.id}`}
      className="font-mono text-ghana-black dark:text-white hover:text-ghana-green transition-colors duration-200"
    >
      {label}
    </Link>
  );

  return (
    <div className="max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-3">
            Operations
          </p>
          <h1 className="font-display text-4xl sm:text-5xl text-ghana-black dark:text-white">
            Payments
          </h1>
          <p className="mt-3 text-sm text-ghana-black/60 dark:text-white/60">
            Payment records, newest orders first. Paystack payments are verified automatically;
            manual records can still be entered. Nothing is charged from this page.
            {loading && payments.length > 0 ? ' Updating…' : ''}
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
          <span className="sr-only">Search payments</span>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghana-black/40 dark:text-white/40"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order number, customer, email or reference"
            className="input-field pl-9"
          />
        </label>

        <div className="flex flex-wrap items-end gap-3">
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
              {PAYMENT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {PAYMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50 mb-2">
              Payment source
            </span>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value as PaymentSource | 'all');
                setLimit(PAGE_SIZE);
              }}
              className="input-field py-2.5 pr-8"
            >
              <option value="all">All</option>
              {PAYMENT_SOURCE_OPTIONS.map((source) => (
                <option key={source} value={source}>
                  {PAYMENT_SOURCE_LABELS[source]}
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

      {loading && payments.length === 0 && !loadError && (
        <p className="mt-8 text-sm text-ghana-black/50 dark:text-white/50">Loading payments…</p>
      )}

      {!loading && payments.length === 0 && !loadError && (
        <p className="mt-10 text-sm text-ghana-black/60 dark:text-white/60">
          {hasFilters
            ? sourceFilter === 'paystack'
              ? 'No Paystack payments yet.'
              : 'No payments match these filters.'
            : 'No orders yet. Payments appear here once customers place orders.'}
        </p>
      )}

      {payments.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.16em] text-ghana-black/50 dark:text-white/50">
                  <th className="text-left font-normal pb-3 pr-4">Order</th>
                  <th className="text-left font-normal pb-3 pr-4">Customer</th>
                  <th className="text-left font-normal pb-3 pr-4">Email</th>
                  <th className="text-right font-normal pb-3 pr-4">Amount</th>
                  <th className="text-left font-normal pb-3 pr-4">Status</th>
                  <th className="text-left font-normal pb-3 pr-4">Source</th>
                  <th className="text-left font-normal pb-3 pr-4">Provider</th>
                  <th className="text-left font-normal pb-3 pr-4">Channel</th>
                  <th className="text-left font-normal pb-3 pr-4">Reference</th>
                  <th className="text-left font-normal pb-3 pr-4">Updated</th>
                  <th className="text-left font-normal pb-3">View</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-t border-ghana-black/10 dark:border-white/10 align-top"
                  >
                    <td className="py-4 pr-4 whitespace-nowrap">
                      {renderOrderLink(payment, payment.orderNumber)}
                    </td>
                    <td className="py-4 pr-4 text-ghana-black/80 dark:text-white/80">
                      <p className="max-w-[14rem] truncate">{payment.customerName}</p>
                    </td>
                    <td className="py-4 pr-4 text-ghana-black/70 dark:text-white/70">
                      <span className="block max-w-[14rem] truncate">
                        {payment.customerEmail ?? '—'}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-right text-ghana-black dark:text-white whitespace-nowrap">
                      {formatCedis(payment.totalAmount)}
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={`text-[10px] uppercase tracking-[0.14em] border rounded-full px-3 py-1 whitespace-nowrap ${paymentPillClass(
                          payment.paymentStatus,
                        )}`}
                      >
                        {PAYMENT_STATUS_LABELS[payment.paymentStatus]}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-ghana-black/70 dark:text-white/70 whitespace-nowrap">
                      {sourceLabel(payment.paymentSource)}
                    </td>
                    <td className="py-4 pr-4 text-ghana-black/70 dark:text-white/70">
                      {payment.paymentProvider ?? '—'}
                    </td>
                    <td className="py-4 pr-4 text-ghana-black/70 dark:text-white/70">
                      {payment.paymentChannel ?? '—'}
                    </td>
                    <td className="py-4 pr-4 text-ghana-black/70 dark:text-white/70">
                      <span className="block max-w-[12rem] truncate">
                        {payment.paymentReference ?? '—'}
                      </span>
                    </td>
                    <td className="py-4 pr-4 whitespace-nowrap text-ghana-black/70 dark:text-white/70">
                      {payment.paymentUpdatedAt
                        ? formatAdminDateTime(payment.paymentUpdatedAt)
                        : formatAdminDate(payment.createdAt)}
                    </td>
                    <td className="py-4 whitespace-nowrap">
                      <Link
                        to={`/admin/payments/${payment.id}`}
                        className="text-[10px] uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden mt-8 space-y-4">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    {renderOrderLink(payment, payment.orderNumber)}
                    <p className="mt-1 text-xs text-ghana-black/55 dark:text-white/55">
                      {formatAdminDate(payment.createdAt)}
                    </p>
                  </div>
                  <p className="font-display text-xl text-ghana-black dark:text-white">
                    {formatCedis(payment.totalAmount)}
                  </p>
                </div>

                <div className="mt-3 space-y-1 text-xs text-ghana-black/70 dark:text-white/70">
                  <p className="truncate">{payment.customerName}</p>
                  <p className="truncate">{payment.customerEmail ?? 'No email on record'}</p>
                  <p>Source: {sourceLabel(payment.paymentSource)}</p>
                  <p>Reference: {payment.paymentReference ?? '—'}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`text-[10px] uppercase tracking-[0.14em] border rounded-full px-3 py-1 ${paymentPillClass(
                      payment.paymentStatus,
                    )}`}
                  >
                    {PAYMENT_STATUS_LABELS[payment.paymentStatus]}
                  </span>
                </div>

                <Link
                  to={`/admin/payments/${payment.id}`}
                  className="mt-4 inline-flex text-[10px] uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
                >
                  View payment
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <p className="text-xs text-ghana-black/50 dark:text-white/50">
              Showing {payments.length} payment{payments.length === 1 ? '' : 's'}
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

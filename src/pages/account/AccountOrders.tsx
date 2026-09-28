import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { GlitchBrand } from '../../components/GlitchBrand';
import { DownloadInvoiceButton } from '../../components/orders/DownloadInvoiceButton';
import { formatGhs } from '../../lib/catalogue/products';
import {
  ORDER_FILTERS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  countOrdersByFilter,
  formatItemCount,
  formatOrderDate,
  listMyOrders,
  orderMatchesFilter,
  type OrderFilter,
  type OrderSummary,
} from '../../lib/account/orders';

/**
 * Order history (Phase E2) — the customer's own orders, newest first.
 *
 * Reads are RLS-scoped to `auth.uid()`, so this list can only ever contain the
 * signed-in customer's orders. Read-only: no editing, no cancellation (that
 * rule is still unconfirmed — see the sprint log's open commerce questions).
 *
 * Filters are applied to the loaded list, so switching between All / Active /
 * Delivered / Cancelled costs no extra requests.
 */
export function AccountOrders() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderFilter>('all');

  const load = useCallback(async () => {
    if (!userId) return;

    setLoadError(null);

    try {
      setOrders(await listMyOrders(userId));
    } catch (err) {
      console.error('Order history load failed:', err);
      setLoadError('We could not load your orders.');
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => countOrdersByFilter(orders ?? []), [orders]);
  const visibleOrders = useMemo(
    () => (orders ?? []).filter((order) => orderMatchesFilter(order, filter)),
    [orders, filter],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          {/* Brand signature (page surface). */}
          <div className="mb-3">
            <GlitchBrand size="corner" />
          </div>

          <h1 className="font-display text-4xl text-ghana-black sm:text-5xl dark:text-white">
            Orders
          </h1>
          <p className="mt-3 text-sm text-ghana-black/60 dark:text-white/60">
            Every order placed with your account, newest first.
          </p>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-ghana-black/10 p-5 text-sm text-ghana-black/70 dark:border-white/10 dark:text-white/70"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            Try again
          </button>
        </div>
      )}

      {orders === null && !loadError && (
        <p className="mt-8 text-sm text-ghana-black/50 dark:text-white/50">Loading orders…</p>
      )}

      {orders !== null && orders.length === 0 && !loadError && (
        <div className="mt-8 rounded-lg border border-dashed border-ghana-black/15 p-8 text-center dark:border-white/15">
          <span
            aria-hidden="true"
            className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-ghana-black/5 dark:bg-white/5"
          >
            <Package size={28} className="text-ghana-black/40 dark:text-white/40" />
          </span>
          <h2 className="font-display text-2xl text-ghana-black dark:text-white">No orders yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ghana-black/60 dark:text-white/60">
            Once you place an order it will appear here with its status and delivery details.
          </p>
          <Link
            to="/shop"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black"
          >
            Start shopping
          </Link>
        </div>
      )}

      {orders !== null && orders.length > 0 && !loadError && (
        <>
          <div
            role="group"
            aria-label="Filter orders"
            className="mt-8 flex flex-wrap gap-2 border-b border-ghana-black/10 pb-4 dark:border-white/10"
          >
            {ORDER_FILTERS.map((option) => {
              const active = filter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  aria-pressed={active}
                  className={`rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.16em] transition-colors duration-200 ${
                    active
                      ? 'bg-ghana-green text-white'
                      : 'text-ghana-black/60 hover:text-ghana-black dark:text-white/60 dark:hover:text-white'
                  }`}
                >
                  {option.label} ({counts[option.id]})
                </button>
              );
            })}
          </div>

          {visibleOrders.length === 0 ? (
            <p className="mt-8 text-sm text-ghana-black/60 dark:text-white/60">
              No orders in this filter.
            </p>
          ) : (
            <ul className="mt-8 space-y-4">
              {visibleOrders.map((order) => (
                <li
                  key={order.id}
                  className="rounded-lg border border-ghana-black/10 p-5 dark:border-white/10"
                >
                  {/* The card is not itself a link: the actions below are real
                      links/buttons, and interactive elements are never nested. */}
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-ghana-black dark:text-white">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1 text-xs text-ghana-black/55 dark:text-white/55">
                        {formatOrderDate(order.createdAt)} · {formatItemCount(order.itemCount)}
                      </p>
                    </div>

                    <p className="font-display text-2xl text-ghana-black dark:text-white">
                      {formatGhs(order.totalAmount)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.16em]">
                    <span
                      className={
                        order.status === 'cancelled'
                          ? 'text-ghana-red'
                          : order.status === 'delivered'
                            ? 'text-ghana-green'
                            : 'text-ghana-black/60 dark:text-white/60'
                      }
                    >
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                    <span
                      className={
                        order.paymentStatus === 'paid'
                          ? 'text-ghana-green'
                          : order.paymentStatus === 'failed'
                            ? 'text-ghana-red'
                            : 'text-ghana-black/60 dark:text-white/60'
                      }
                    >
                      Payment: {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-ghana-black/10 pt-4 dark:border-white/10">
                    <Link
                      to={`/account/orders/${order.orderNumber}`}
                      className="text-xs uppercase tracking-[0.16em] text-ghana-green transition-colors duration-200 hover:text-ghana-black dark:hover:text-white"
                    >
                      View order
                    </Link>
                    <DownloadInvoiceButton
                      userId={userId}
                      orderNumber={order.orderNumber}
                      variant="quiet"
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

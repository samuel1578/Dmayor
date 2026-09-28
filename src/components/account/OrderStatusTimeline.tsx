import { Check, XCircle } from 'lucide-react';
import { FULFILMENT_STEPS, ORDER_STATUS_LABELS } from '../../lib/account/orders';
import type { OrderStatus } from '../../lib/supabase';

/**
 * Restrained fulfilment timeline (Phase E2).
 *
 * Pending → Confirmed → Processing → Shipped → Delivered, with the status
 * recorded on the order highlighted. `cancelled` is a terminal state rendered
 * on its own — it is never shown as a step on the progress line.
 *
 * This reflects the status stored on the order. It is deliberately NOT live
 * courier tracking: there is no carrier integration, no GPS and no map, and the
 * copy says so.
 */
export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  const cancelled = status === 'cancelled';
  const currentIndex = FULFILMENT_STEPS.indexOf(status);

  return (
    <section
      aria-labelledby="order-progress-heading"
      className="rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10"
    >
      <h2
        id="order-progress-heading"
        className="font-display text-2xl text-ghana-black dark:text-white"
      >
        Order progress
      </h2>
      <p className="mt-2 text-xs text-ghana-black/55 dark:text-white/55">
        The status recorded on this order — not live courier tracking.
      </p>

      {cancelled ? (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-ghana-red/40 p-4">
          <XCircle size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-ghana-red" />
          <div>
            <p className="text-sm font-semibold text-ghana-red">
              {ORDER_STATUS_LABELS.cancelled}
            </p>
            <p className="mt-1 text-xs text-ghana-black/60 dark:text-white/60">
              This order was cancelled and its progress stops here.
            </p>
          </div>
        </div>
      ) : (
        <ol className="mt-5 space-y-4 sm:grid sm:grid-cols-5 sm:gap-3 sm:space-y-0">
          {FULFILMENT_STEPS.map((step, index) => {
            const done = index < currentIndex;
            const current = index === currentIndex;

            return (
              <li
                key={step}
                className="flex items-start gap-3 sm:block"
                aria-current={current ? 'step' : undefined}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    done
                      ? 'bg-ghana-green text-white'
                      : current
                        ? 'border-2 border-ghana-green text-ghana-green'
                        : 'border border-ghana-black/15 text-ghana-black/40 dark:border-white/20 dark:text-white/40'
                  }`}
                >
                  {done ? <Check size={13} strokeWidth={3} /> : index + 1}
                </span>

                <span className="sm:mt-2 sm:block">
                  <span
                    className={`block text-sm ${
                      current
                        ? 'font-semibold text-ghana-black dark:text-white'
                        : done
                          ? 'text-ghana-black/75 dark:text-white/75'
                          : 'text-ghana-black/45 dark:text-white/45'
                    }`}
                  >
                    {ORDER_STATUS_LABELS[step]}
                  </span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-[0.16em] text-ghana-black/40 dark:text-white/40">
                    {done ? 'Done' : current ? 'Current' : 'Upcoming'}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

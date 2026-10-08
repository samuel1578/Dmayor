import { useRef, useState } from 'react';
import type { OrderPaymentStatus, OrderStatus } from '../../lib/supabase';
import {
  PaymentRequestError,
  createPaymentGuard,
  initializePaystackPayment,
  paymentActionFor,
} from '../../lib/payments/paystack';

/**
 * Shared customer payment action (Phase F2).
 *
 * One place owns: eligibility, Pay Now / Retry Payment labelling, the loading
 * state, the initialize call, the safe full-page redirect to Paystack and the
 * normalized error copy. It is used by the order detail view (and therefore the
 * order confirmation page) and the customer payment detail page, so there is a
 * single initialization path.
 *
 * It deliberately receives only identifiers and statuses — never an amount,
 * currency, email or user id. Those are derived by the server.
 */

interface PaymentActionProps {
  /** The order id (internal uuid) — the only value sent to the server. */
  orderId: string;
  paymentStatus: OrderPaymentStatus;
  orderStatus: OrderStatus;
  className?: string;
}

const NOTE = "You'll continue to our secure payment provider to complete this payment.";

export function PaymentAction({
  orderId,
  paymentStatus,
  orderStatus,
  className,
}: PaymentActionProps) {
  const guardRef = useRef(createPaymentGuard());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const action = paymentActionFor(paymentStatus, orderStatus);

  // paid / refunded / cancelled: no payment action at all.
  if (!action) return null;

  const handleClick = () => {
    if (starting) return;
    setError(null);

    void guardRef.current.run(async () => {
      setStarting(true);
      try {
        const result = await initializePaystackPayment(orderId);
        if (!result.authorizationUrl) {
          throw new PaymentRequestError(
            'payment_initialize_failed',
            'We could not start the payment. Please try again.',
          );
        }
        // Deliberate full-page redirect to Paystack hosted checkout.
        window.location.assign(result.authorizationUrl);
      } catch (err) {
        console.error('Payment initialization failed:', err);
        setError(
          err instanceof PaymentRequestError
            ? err.message
            : 'We could not start the payment. Please try again.',
        );
        setStarting(false);
      }
    });
  };

  const noteId = `payment-action-note-${action.kind}`;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={starting}
        aria-busy={starting}
        aria-describedby={!error && !starting ? noteId : undefined}
        className="w-full rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {starting ? 'Preparing secure payment…' : action.label}
      </button>

      {starting && (
        <p role="status" aria-live="polite" className="mt-2 text-xs text-ghana-black/60 dark:text-white/60">
          Opening the secure payment page…
        </p>
      )}

      {!starting && error && (
        <p role="alert" className="mt-2 text-xs text-ghana-red">
          {error}
        </p>
      )}

      {!starting && !error && (
        <p id={noteId} className="mt-2 text-xs text-ghana-black/60 dark:text-white/60">
          {NOTE}
        </p>
      )}
    </div>
  );
}

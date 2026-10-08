import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react';
import { GlitchBrand } from '../components/GlitchBrand';
import {
  PaymentRequestError,
  createPaymentGuard,
  verifyPaystackPayment,
  type VerifyPaymentResult,
} from '../lib/payments/paystack';
import {
  callbackOutcomeFromError,
  callbackOutcomeFromVerifyResult,
  extractCallbackReference,
  type CallbackOutcome,
} from '../lib/payments/callback';
import { formatGhs } from '../lib/catalogue/products';

/**
 * Paystack return / callback page (Phase F2).
 *
 * The URL is used ONLY to read the provider reference. Status, amount, email,
 * order number and any other query parameter are ignored. The reference is
 * verified server-to-server (`verify-payment`), and only that trusted result
 * decides what is shown. The order is never marked paid here.
 *
 * This route sits inside the customer `AuthenticatedRoute`, so if the session
 * has expired the customer is sent to /login and returned to this exact URL
 * (reference included) afterwards.
 */
export function PaymentCallback() {
  const location = useLocation();
  const reference = useMemo(() => extractCallbackReference(location.search), [location.search]);

  const guardRef = useRef(createPaymentGuard());
  const [outcome, setOutcome] = useState<CallbackOutcome>(() =>
    reference ? 'verifying' : 'invalid_reference',
  );
  const [result, setResult] = useState<VerifyPaymentResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runVerification = useCallback(async () => {
    if (!reference) {
      setOutcome('invalid_reference');
      return;
    }

    setOutcome('verifying');
    setErrorMessage(null);

    await guardRef.current.run(async () => {
      try {
        const verified = await verifyPaystackPayment(reference);
        setResult(verified);
        setOutcome(callbackOutcomeFromVerifyResult(verified));
      } catch (err) {
        const code = err instanceof PaymentRequestError ? err.code : null;
        setErrorMessage(
          err instanceof PaymentRequestError
            ? err.message
            : "We couldn't verify this payment right now.",
        );
        setOutcome(callbackOutcomeFromError(code));
      }
    });
  }, [reference]);

  useEffect(() => {
    void runVerification();
  }, [runVerification]);

  const paymentHref = result?.orderNumber
    ? `/account/payments/${result.orderNumber}`
    : '/account/payments';
  const orderHref = result?.orderNumber ? `/account/orders/${result.orderNumber}` : null;

  return (
    <div className="bg-ghana-light py-16 transition-colors duration-300 dark:bg-ghana-dark md:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <GlitchBrand size="lg" />

        <div className="mt-8 rounded-lg border border-ghana-black/10 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-ghana-black">
          {outcome === 'verifying' && <VerifyingState />}

          {outcome === 'success' && result && (
            <ResultBlock
              icon={<CheckCircle2 size={26} aria-hidden="true" />}
              tone="green"
              eyebrow="Payment"
              title="Payment successful"
            >
              <p className="mt-2 text-sm text-ghana-black/70 dark:text-white/70">
                We verified your payment with our provider. This order is now marked as paid.
              </p>
              <ResultDetails result={result} />
              <div className="mt-6 flex flex-wrap gap-3">
                <PrimaryLink to={paymentHref}>View Payment</PrimaryLink>
                {orderHref && <SecondaryLink to={orderHref}>View Order</SecondaryLink>}
              </div>
            </ResultBlock>
          )}

          {outcome === 'failed' && result && (
            <ResultBlock
              icon={<XCircle size={26} aria-hidden="true" />}
              tone="red"
              eyebrow="Payment"
              title="Payment was not completed"
            >
              <p className="mt-2 text-sm text-ghana-black/70 dark:text-white/70">
                This payment was not completed. No payment has been recorded for this order — you can
                try again from the payment page.
              </p>
              <ResultDetails result={result} />
              <div className="mt-6 flex flex-wrap gap-3">
                <PrimaryLink to={paymentHref}>View Payment</PrimaryLink>
                {orderHref && <SecondaryLink to={orderHref}>View Order</SecondaryLink>}
              </div>
            </ResultBlock>
          )}

          {outcome === 'pending' && (
            <ResultBlock
              icon={<Clock size={26} aria-hidden="true" />}
              tone="neutral"
              eyebrow="Payment"
              title="Payment verification is still pending"
            >
              <p className="mt-2 text-sm text-ghana-black/70 dark:text-white/70">
                Your payment has not been confirmed yet, so this order has not been marked paid.
                This can happen if the provider is still processing. Check again in a moment.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ActionButton onClick={() => void runVerification()}>Check Again</ActionButton>
                <SecondaryLink to={paymentHref}>View Payment</SecondaryLink>
              </div>
            </ResultBlock>
          )}

          {outcome === 'verification_error' && (
            <ResultBlock
              icon={<AlertTriangle size={26} aria-hidden="true" />}
              tone="red"
              eyebrow="Payment"
              title="We couldn't verify this payment right now"
            >
              <p className="mt-2 text-sm text-ghana-black/70 dark:text-white/70">
                {errorMessage ?? 'This is a temporary problem on our side. No payment status was changed.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ActionButton onClick={() => void runVerification()}>
                  Try Verification Again
                </ActionButton>
                <SecondaryLink to={paymentHref}>View Payment</SecondaryLink>
              </div>
            </ResultBlock>
          )}

          {outcome === 'invalid_reference' && (
            <ResultBlock
              icon={<ShieldAlert size={26} aria-hidden="true" />}
              tone="red"
              eyebrow="Payment"
              title="Invalid payment return"
            >
              <p className="mt-2 text-sm text-ghana-black/70 dark:text-white/70">
                We could not find a payment reference in this link, so nothing was verified. If you
                completed a payment, open the order from your payments page.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <PrimaryLink to="/account/payments">Go to Payments</PrimaryLink>
              </div>
            </ResultBlock>
          )}

          {outcome === 'conflict' && (
            <ResultBlock
              icon={<ShieldAlert size={26} aria-hidden="true" />}
              tone="neutral"
              eyebrow="Payment"
              title="This payment needs review"
            >
              <p className="mt-2 text-sm text-ghana-black/70 dark:text-white/70">
                Your order already has a different payment record. No additional payment status was
                applied. Please contact support so we can review it.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <PrimaryLink to={paymentHref}>View Payment</PrimaryLink>
                {orderHref && <SecondaryLink to={orderHref}>View Order</SecondaryLink>}
              </div>
            </ResultBlock>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function VerifyingState() {
  return (
    <div role="status" aria-live="polite" className="text-center">
      <div
        aria-hidden="true"
        className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-ghana-black/10 border-t-ghana-green dark:border-white/10 dark:border-t-ghana-green"
      />
      <h1 className="font-display text-2xl text-ghana-black dark:text-white">
        Verifying your payment…
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-ghana-black/60 dark:text-white/60">
        Please wait while we confirm this payment with our provider. Do not close this page.
      </p>
    </div>
  );
}

type Tone = 'green' | 'red' | 'neutral';

const TONE_ICON: Record<Tone, string> = {
  green: 'bg-ghana-green/10 text-ghana-green',
  red: 'bg-ghana-red/10 text-ghana-red',
  neutral: 'bg-ghana-black/5 text-ghana-black/70 dark:bg-white/10 dark:text-white/70',
};

function ResultBlock({
  icon,
  tone,
  eyebrow,
  title,
  children,
}: {
  icon: ReactNode;
  tone: Tone;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 items-center justify-center rounded-full ${TONE_ICON[tone]}`}
        >
          {icon}
        </span>
        <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green">{eyebrow}</p>
      </div>
      <h1 className="mt-4 font-display text-2xl text-ghana-black dark:text-white sm:text-3xl">
        {title}
      </h1>
      {children}
    </div>
  );
}

function ResultDetails({ result }: { result: VerifyPaymentResult }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Order number', value: result.orderNumber },
    { label: 'Amount', value: formatGhs(result.amount) },
    { label: 'Reference', value: result.reference },
    { label: 'Provider', value: 'Paystack' },
  ];

  if (result.channel) rows.push({ label: 'Channel', value: result.channel });

  return (
    <dl className="mt-5 space-y-2 border-t border-ghana-black/10 pt-5 text-sm dark:border-white/10">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4">
          <dt className="text-ghana-black/50 dark:text-white/50">{row.label}</dt>
          <dd className="break-all text-right font-mono text-ghana-black/80 dark:text-white/80">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PrimaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black"
    >
      {children}
    </Link>
  );
}

function SecondaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-ghana-black/15 px-5 py-3 text-xs uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white"
    >
      {children}
    </Link>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black"
    >
      {children}
    </button>
  );
}

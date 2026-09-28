import { useState } from 'react';
import { FileDown } from 'lucide-react';
import type { OrderDetail } from '../../lib/account/orders';
import { downloadOrderInvoice, downloadOrderInvoiceByNumber } from '../../lib/orders/invoice';

type Variant = 'primary' | 'secondary' | 'quiet';

interface DownloadInvoiceButtonProps {
  /** Session user id — the invoice read is scoped to it, then RLS checks ownership. */
  userId: string;
  orderNumber: string;
  /**
   * The full order when the page already has it (skips a re-fetch). Lists only
   * hold summaries, so they omit it and the button loads the order itself —
   * always through the customer's normal RLS-protected query.
   */
  order?: OrderDetail;
  variant?: Variant;
  label?: string;
  className?: string;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black',
  secondary:
    'rounded-lg border border-ghana-black/15 px-5 py-3 text-xs uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white',
  quiet:
    'text-xs uppercase tracking-[0.16em] text-ghana-green transition-colors duration-200 hover:text-ghana-black dark:hover:text-white',
};

/**
 * Download Invoice (Phase E4).
 *
 * Generates a fresh PDF from the order's CURRENT recorded state every time it
 * is clicked — nothing is generated or cached at checkout, so an Admin changing
 * payment or fulfilment status is reflected immediately in the next download.
 *
 * The document is never built from URL parameters: the order is either already
 * on the page or fetched by number through the customer's own RLS-scoped query.
 */
export function DownloadInvoiceButton({
  userId,
  orderNumber,
  order,
  variant = 'secondary',
  label = 'Download Invoice',
  className,
}: DownloadInvoiceButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      if (order) {
        await downloadOrderInvoice(order);
      } else {
        await downloadOrderInvoiceByNumber(userId, orderNumber);
      }
    } catch (err) {
      // Never surface library internals — just the plain outcome.
      console.error('Invoice generation failed:', err);
      setError("We couldn't prepare the invoice. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        aria-busy={busy}
        className={`inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 ${
          VARIANT_CLASSES[variant]
        } ${className ?? ''}`}
      >
        <FileDown size={variant === 'quiet' ? 14 : 16} aria-hidden="true" />
        {busy ? 'Preparing invoice…' : label}
        {/* Keeps the accessible name descriptive without overriding the label. */}
        <span className="sr-only">for order {orderNumber}</span>
      </button>

      {error && (
        <span role="alert" className="text-xs text-ghana-red">
          {error}
        </span>
      )}
    </span>
  );
}

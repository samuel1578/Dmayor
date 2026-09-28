import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, MapPin, ShoppingBag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { listAddresses, type CustomerAddress } from '../lib/account/addresses';
import {
  checkoutErrorMessage,
  placeOrder,
  previewCartOrder,
  type CheckoutPreview,
} from '../lib/checkout/orders';
import { formatGhs } from '../lib/catalogue/products';
import { GlitchBrand } from '../components/GlitchBrand';
import { ProductImagePlaceholder } from '../components/ProductImagePlaceholder';

/**
 * Comparable fingerprint of everything the customer is shown on this page.
 * Used to detect a price/stock change between the displayed preview and the
 * final revalidation, so a stale total is never presented as current.
 */
function checkoutSignature(preview: CheckoutPreview): string {
  const lines = [...preview.lines]
    .map(
      (line) =>
        `${line.variantId ?? line.productName}:${line.quantity}:${line.unitPrice.toFixed(2)}`,
    )
    .sort()
    .join('|');

  return [
    lines,
    preview.subtotal.toFixed(2),
    preview.shipping.toFixed(2),
    preview.tax.toFixed(2),
    preview.total.toFixed(2),
  ].join('::');
}

/**
 * Checkout (Phase E1).
 *
 * Everything priced or validated on this page comes from the database:
 * `preview_cart_order()` returns the server's current prices, stock, delivery
 * totals and blockers, and `create_order_from_cart()` re-runs every check
 * atomically when the order is actually created. The browser never submits a
 * price, a total, a stock figure, an order status or a payment status.
 *
 * NO payment provider exists in E1 — the button says "Place Order", the created
 * order is `unpaid`, and the page never claims a payment succeeded.
 *
 * Delivery/tax amounts come from the single provisional config row in the
 * database. While `rulesConfirmed` is false the page says so instead of
 * presenting those figures as store policy.
 */
export function Checkout() {
  const { user } = useAuth();
  const { refreshCart, itemCount } = useCart();
  const navigate = useNavigate();

  const userId = user?.id ?? null;

  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState('');

  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);

  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  /** Read-only server preview — also the final revalidation pass. */
  const runPreview = useCallback(async () => {
    try {
      const next = await previewCartOrder();
      setPreview(next);
      return next;
    } catch (err) {
      console.error('Checkout preview failed:', err);
      setLoadError(checkoutErrorMessage(err));
      return null;
    }
  }, []);

  const loadEverything = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setLoadError(null);
    setAddressesError(null);

    const [addressResult, previewResult] = await Promise.allSettled([
      listAddresses(userId),
      previewCartOrder(),
    ]);

    if (addressResult.status === 'fulfilled') {
      const rows = addressResult.value;
      setAddresses(rows);
      // Default address preselected, otherwise the first saved one.
      const preferred = rows.find((row) => row.isDefault) ?? rows[0];
      if (preferred) setSelectedAddressId((current) => current || preferred.id);
    } else {
      console.error('Address load failed:', addressResult.reason);
      setAddresses([]);
      setAddressesError('We could not load your saved addresses.');
    }

    if (previewResult.status === 'fulfilled') {
      setPreview(previewResult.value);
    } else {
      console.error('Checkout preview failed:', previewResult.reason);
      setLoadError(checkoutErrorMessage(previewResult.reason));
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadEverything();
  }, [loadEverything]);

  const handleRecheck = async () => {
    setRechecking(true);
    setPlaceError(null);
    await runPreview();
    setRechecking(false);
  };

  const handlePlaceOrder = async () => {
    if (!preview || placing) return;
    if (preview.blockers.length > 0 || preview.lines.length === 0) return;
    if (!selectedAddressId) {
      setPlaceError('Choose a delivery address before placing your order.');
      return;
    }

    setPlacing(true);
    setPlaceError(null);

    try {
      // Final revalidation before the order is submitted: the customer must
      // never place an order against totals or availability that have moved on.
      const fresh = await previewCartOrder();

      if (fresh.blockers.length > 0 || fresh.lines.length === 0) {
        setPreview(fresh);
        setPlaceError(
          'Your cart changed while you were checking out. Please review the updated details above.',
        );
        return;
      }

      if (!preview || checkoutSignature(preview) !== checkoutSignature(fresh)) {
        setPreview(fresh);
        setPlaceError(
          'Prices or availability changed since this page loaded. The totals above are now up to date — please review them and place your order again.',
        );
        return;
      }

      const order = await placeOrder(selectedAddressId);
      // The order RPC already cleared the cart server-side — reload it so the
      // navbar badge reflects the committed state rather than guessing.
      void refreshCart();
      navigate(`/order-confirmation/${order.orderNumber}`, { replace: true });
    } catch (err) {
      console.error('Order creation failed:', err);
      setPlaceError(checkoutErrorMessage(err));
      // A failure is most likely a changed price, stock or availability, so
      // refresh the authoritative preview instead of showing stale totals.
      void runPreview();
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen flex flex-col">
        <div className="flex-grow flex items-center justify-center px-4 py-16">
          <div role="status" aria-live="polite" className="text-center">
            <div
              aria-hidden="true"
              className="mx-auto mb-6 h-14 w-14 animate-spin rounded-full border-4 border-gray-200 border-t-ghana-green dark:border-gray-700 dark:border-t-ghana-green"
            />
            <p className="text-lg text-gray-600 dark:text-gray-400">Preparing your checkout…</p>
          </div>
        </div>
      </div>
    );
  }

  const previewLines = preview?.lines ?? [];
  const blockers = preview?.blockers ?? [];
  const canPlace =
    Boolean(preview) &&
    previewLines.length > 0 &&
    blockers.length === 0 &&
    Boolean(selectedAddressId) &&
    !placing;

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Brand signature on the page surface. Wrapped, because module CSS is
              unlayered and would beat spacing utilities on the mark itself. */}
          <div className="mb-4">
            <GlitchBrand size="corner" />
          </div>

          <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green">Checkout</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold text-ghana-black dark:text-white">
            Place your order
          </h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {itemCount} item{itemCount === 1 ? '' : 's'} ready. Confirm your delivery details and
            your order will be recorded — payment is not taken on this site yet.
          </p>
        </motion.div>

        {loadError && (
          <div
            role="alert"
            className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-ghana-red/40 bg-white/60 p-5 text-sm text-ghana-black dark:bg-white/[0.03] dark:text-white"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => void loadEverything()}
              className="text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!loadError && previewLines.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 rounded-lg bg-white p-8 text-center dark:bg-ghana-black"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
              <ShoppingBag size={36} className="text-gray-400" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-bold text-ghana-black dark:text-white">
              There is nothing to check out
            </h2>
            <p className="mt-3 text-gray-600 dark:text-gray-400">
              Add an item to your cart and come back.
            </p>
            <Link
              to="/shop"
              className="btn-primary bg-ghana-green text-white mt-6 inline-flex items-center gap-2"
            >
              Continue Shopping
              <ArrowRight size={20} />
            </Link>
          </motion.div>
        )}

        {!loadError && previewLines.length > 0 && (
          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              {/* ------------------------- Delivery address ------------------------ */}
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                aria-labelledby="delivery-heading"
                className="bg-white dark:bg-ghana-black rounded-lg p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2
                    id="delivery-heading"
                    className="text-lg font-bold text-ghana-black dark:text-white flex items-center gap-2"
                  >
                    <MapPin size={20} aria-hidden="true" className="text-ghana-green" />
                    Delivery address
                  </h2>
                  <Link
                    to="/account/addresses"
                    className="text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
                  >
                    Manage addresses
                  </Link>
                </div>

                {addressesError && (
                  <p role="alert" className="mt-4 text-sm text-ghana-red">
                    {addressesError} You can still add or edit addresses in your account.
                  </p>
                )}

                {addresses !== null && addresses.length === 0 && (
                  <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-5 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You have no saved delivery addresses yet. Add one to place your order.
                    </p>
                    <Link
                      to="/account/addresses"
                      className="btn-primary bg-ghana-green text-white mt-4 inline-flex items-center gap-2"
                    >
                      Add a delivery address
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                )}

                {addresses !== null && addresses.length > 0 && (
                  <fieldset className="mt-5 space-y-3">
                    <legend className="sr-only">Choose a delivery address</legend>
                    {addresses.map((address) => {
                      const selected = selectedAddressId === address.id;
                      const lines = [
                        address.addressLine1,
                        address.addressLine2,
                        address.city,
                        address.region,
                        address.postalCode,
                        address.country,
                      ].filter((part): part is string => Boolean(part));

                      return (
                        <label
                          key={address.id}
                          className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                            selected
                              ? 'border-ghana-green bg-ghana-green/5'
                              : 'border-gray-200 hover:border-ghana-green/50 dark:border-gray-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="delivery-address"
                            value={address.id}
                            checked={selected}
                            onChange={() => setSelectedAddressId(address.id)}
                            className="mt-1 accent-ghana-green"
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ghana-black dark:text-white">
                              {address.recipientName}
                              {address.isDefault && (
                                <span className="rounded-full bg-ghana-green/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-ghana-green">
                                  Default
                                </span>
                              )}
                              {address.label && (
                                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                  {address.label}
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">
                              {address.phone}
                            </span>
                            <span className="mt-1 block text-sm text-gray-600 dark:text-gray-400">
                              {lines.join(', ')}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                )}
              </motion.section>

              {/* --------------------------- Cart summary -------------------------- */}
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                aria-labelledby="checkout-items-heading"
                className="bg-white dark:bg-ghana-black rounded-lg overflow-hidden"
              >
                <div className="border-b border-gray-200 p-6 dark:border-gray-700">
                  <h2
                    id="checkout-items-heading"
                    className="text-lg font-bold text-ghana-black dark:text-white"
                  >
                    Your items ({previewLines.length})
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Prices and availability shown here come from the store catalogue.
                  </p>
                </div>

                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {previewLines.map((line) => (
                    <div
                      key={line.variantId ?? line.productName}
                      className={`flex gap-4 p-6 ${line.purchasable ? '' : 'opacity-70'}`}
                    >
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                        {line.imageUrl ? (
                          <img
                            src={line.imageUrl}
                            alt={line.productName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ProductImagePlaceholder label="No image" />
                        )}
                      </div>

                      <div className="min-w-0 flex-grow">
                        <h3 className="text-base font-semibold text-ghana-black dark:text-white">
                          {line.productSlug ? (
                            <Link
                              to={`/product/${line.productSlug}`}
                              className="hover:text-ghana-green transition-colors"
                            >
                              {line.productName}
                            </Link>
                          ) : (
                            line.productName
                          )}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {[line.size && `Size ${line.size}`, line.colour]
                            .filter(Boolean)
                            .join(' · ') || 'Option unavailable'}
                        </p>
                        {line.variantSku && (
                          <p className="mt-0.5 text-xs text-gray-500">SKU: {line.variantSku}</p>
                        )}
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {formatGhs(line.unitPrice)} each · Quantity {line.quantity}
                        </p>
                        {line.issue && (
                          <p role="alert" className="mt-2 text-xs font-semibold text-ghana-red">
                            {line.issue}
                          </p>
                        )}
                      </div>

                      <p className="whitespace-nowrap text-lg font-bold text-ghana-black dark:text-white">
                        {formatGhs(line.lineTotal)}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.section>
            </div>

            {/* ------------------------------ Totals ---------------------------- */}
            <motion.aside
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="lg:col-span-1"
            >
              <div className="sticky top-24 rounded-lg bg-white p-6 dark:bg-ghana-black">
                <h2 className="text-lg font-bold text-ghana-black dark:text-white">Order totals</h2>

                <div className="mt-6 space-y-4 border-b border-gray-200 pb-6 dark:border-gray-700">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span>{formatGhs(preview?.subtotal ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Delivery</span>
                    <span>{formatGhs(preview?.shipping ?? 0)}</span>
                  </div>
                  {(preview?.tax ?? 0) > 0 && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Tax</span>
                      <span>{formatGhs(preview?.tax ?? 0)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="text-lg font-bold text-ghana-black dark:text-white">Total</span>
                  <span className="text-3xl font-bold text-ghana-green">
                    {formatGhs(preview?.total ?? 0)}
                  </span>
                </div>

                {/* Honest disclosure while the commerce rules are unconfirmed. */}
                {preview && !preview.settings.rulesConfirmed && (
                  <p className="mt-4 rounded-lg border border-ghana-black/10 p-3 text-xs leading-relaxed text-ghana-black/70 dark:border-white/10 dark:text-white/70">
                    Delivery and tax rules have not been finalised for the store yet. The amounts
                    above are the current unconfirmed defaults — no delivery fee and no tax are being
                    added.
                  </p>
                )}

                {blockers.length > 0 && (
                  <div
                    role="alert"
                    className="mt-6 rounded-lg border border-ghana-red/40 p-4 text-sm text-ghana-black dark:text-white"
                  >
                    <p className="flex items-center gap-2 font-semibold text-ghana-red">
                      <AlertCircle size={16} aria-hidden="true" />
                      This cart cannot be ordered yet
                    </p>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
                      {blockers.map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={() => void handleRecheck()}
                        disabled={rechecking}
                        aria-busy={rechecking}
                        className="text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black disabled:opacity-60 dark:hover:text-white"
                      >
                        {rechecking ? 'Checking…' : 'Re-check cart'}
                      </button>
                      <Link
                        to="/cart"
                        className="text-xs uppercase tracking-[0.16em] text-ghana-black/70 hover:text-ghana-green dark:text-white/70"
                      >
                        Review cart
                      </Link>
                    </div>
                  </div>
                )}

                {placeError && (
                  <p role="alert" className="mt-6 text-sm text-ghana-red">
                    {placeError}
                  </p>
                )}

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => void handlePlaceOrder()}
                    disabled={!canPlace}
                    aria-busy={placing}
                    className="btn-primary bg-ghana-green text-white w-full disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {placing ? 'Placing your order…' : 'Place Order'}
                  </button>
                  <Link
                    to="/cart"
                    className="btn-secondary border-ghana-green text-ghana-green w-full text-center"
                  >
                    Back to cart
                  </Link>
                </div>

                <p className="mt-6 border-t border-gray-200 pt-6 text-xs leading-relaxed text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  Placing an order records it against your account as unpaid. No card details are
                  collected and no payment is taken on this site yet.
                </p>
              </div>
            </motion.aside>
          </div>
        )}
      </div>
    </div>
  );
}

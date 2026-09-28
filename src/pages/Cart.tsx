import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, AlertCircle } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { ProductImagePlaceholder } from '../components/ProductImagePlaceholder';
import { formatGhs } from '../lib/catalogue/products';

export function Cart() {
  const {
    items,
    removeItem,
    updateQuantity,
    total,
    clearCart,
    unavailableCount,
    revalidating,
    loading,
    cartNotice,
    dismissNotice,
    revalidateCart,
  } = useCart();

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const hasRevalidated = useRef(false);

  // Re-check saved lines against the live catalogue once per cart visit
  // (revalidation itself rewrites the items, so it must not re-trigger).
  useEffect(() => {
    if (hasRevalidated.current) return;
    hasRevalidated.current = true;
    void revalidateCart();
  }, [revalidateCart]);

  const shipping = items.length > 0 ? 50 : 0;
  const grandTotal = total + shipping;

  const notice = cartNotice;
  const noticeBlock = notice ? (
    <div
      role="status"
      className="mx-auto mb-8 flex max-w-2xl items-start gap-3 rounded-lg border border-ghana-green/40 bg-white/60 p-4 text-left text-sm text-ghana-black dark:bg-white/[0.03] dark:text-white"
    >
      <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-ghana-green" aria-hidden="true" />
      <span className="flex-grow">{notice}</span>
      <button
        type="button"
        onClick={dismissNotice}
        className="text-xs uppercase tracking-[0.16em] text-gray-500 hover:text-ghana-green dark:text-gray-400"
      >
        Dismiss
      </button>
    </div>
  ) : null;

  // The active cart source (localStorage or Supabase) is still resolving —
  // an authenticated cart is being merged/loaded. Never flash the empty state
  // or a stale guest count during that window.
  if (loading) {
    return (
      <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen flex flex-col">
        <div className="flex-grow flex items-center justify-center px-4 py-16">
          <div role="status" aria-live="polite" className="text-center">
            <div
              aria-hidden="true"
              className="mx-auto mb-6 h-14 w-14 animate-spin rounded-full border-4 border-gray-200 border-t-ghana-green dark:border-gray-700 dark:border-t-ghana-green"
            />
            <p className="text-lg text-gray-600 dark:text-gray-400">Loading your cart…</p>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen flex flex-col">
        <div className="flex-grow flex items-center justify-center px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full text-center"
          >
            {noticeBlock}
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
              <ShoppingBag size={48} className="text-gray-400" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-ghana-black dark:text-white mb-4">
              Your Cart is Empty
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              Start shopping and add some amazing Proxy Shop pieces to your cart.
            </p>
            <Link to="/shop" className="btn-primary bg-ghana-green text-white inline-flex items-center gap-2">
              Continue Shopping
              <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-bold text-ghana-black dark:text-white flex items-center gap-3"
        >
          <ShoppingBag size={40} />
          Shopping Cart
        </motion.h1>
        {revalidating && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400" role="status">
            Checking availability…
          </p>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {noticeBlock}

        {actionMessage && (
          <p role="alert" className="mb-6 text-sm text-ghana-red">
            {actionMessage}
          </p>
        )}

        {unavailableCount > 0 && (
          <p role="alert" className="mb-6 text-sm text-ghana-red">
            {unavailableCount} item{unavailableCount === 1 ? '' : 's'} in your cart{' '}
            {unavailableCount === 1 ? 'is' : 'are'} no longer available and excluded from the total.
            Remove {unavailableCount === 1 ? 'it' : 'them'} to continue.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-ghana-black rounded-lg overflow-hidden"
            >
              <div className="border-b border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-bold text-ghana-black dark:text-white">
                  Items ({items.length})
                </h2>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-6 flex flex-col md:flex-row gap-6 ${
                      item.available ? '' : 'opacity-70'
                    }`}
                  >
                    <div className="w-full md:w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ProductImagePlaceholder label="No image" />
                      )}
                    </div>

                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold text-ghana-black dark:text-white mb-2">
                        {item.productSlug ? (
                          <Link
                            to={`/product/${item.productSlug}`}
                            className="hover:text-ghana-green transition-colors"
                          >
                            {item.productName}
                          </Link>
                        ) : (
                          item.productName
                        )}
                      </h3>

                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {[item.size && `Size ${item.size}`, item.colour].filter(Boolean).join(' · ') ||
                          'Option unavailable'}
                      </p>
                      {item.sku && <p className="text-xs text-gray-500 mb-1">SKU: {item.sku}</p>}

                      {!item.available && (
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-ghana-red">
                          Unavailable
                        </p>
                      )}
                      {item.note && (
                        <p
                          className={`mb-1 text-xs ${
                            item.available ? 'text-ghana-black/60 dark:text-white/60' : 'text-ghana-red'
                          }`}
                        >
                          {item.note}
                        </p>
                      )}

                      <p className="text-2xl font-bold text-ghana-green mb-4">
                        {formatGhs(item.price)} each
                      </p>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setActionMessage(updateQuantity(item.id, item.quantity - 1).message ?? null)}
                            aria-label={`Decrease quantity of ${item.productName}`}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <Minus size={18} className="text-ghana-green" />
                          </button>
                          <span
                            className="px-4 font-semibold text-ghana-black dark:text-white"
                            aria-label={`Quantity ${item.quantity}`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActionMessage(updateQuantity(item.id, item.quantity + 1).message ?? null)}
                            disabled={!item.available || item.quantity >= item.stock}
                            aria-label={`Increase quantity of ${item.productName}`}
                            className="p-2 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800"
                          >
                            <Plus size={18} className="text-ghana-green" />
                          </button>
                        </div>

                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.available && item.stock > 0 ? `${item.stock} in stock` : 'Not in stock'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between">
                      <p className="text-2xl font-bold text-ghana-black dark:text-white">
                        {formatGhs(item.price * item.quantity)}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          removeItem(item.id);
                          setActionMessage(null);
                        }}
                        aria-label={`Remove ${item.productName} from cart`}
                        className="p-2 text-ghana-red hover:bg-red-50 dark:hover:bg-red-900 dark:hover:bg-opacity-20 rounded-lg transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-ghana-red hover:text-ghana-red hover:opacity-80 font-semibold transition-opacity"
                >
                  Clear Cart
                </button>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1"
          >
            <div className="bg-white dark:bg-ghana-black rounded-lg p-6 sticky top-24">
              <h2 className="text-lg font-bold text-ghana-black dark:text-white mb-6">
                Order Summary
              </h2>

              <div className="space-y-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>{formatGhs(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Shipping</span>
                  <span>{formatGhs(shipping)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Tax (10%)</span>
                  <span>{formatGhs(total * 0.1)}</span>
                </div>
              </div>

              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-ghana-black dark:text-white">
                    Total
                  </span>
                  <span className="text-3xl font-bold text-ghana-green">
                    {formatGhs(grandTotal + total * 0.1)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  disabled={unavailableCount > 0}
                  className="btn-primary bg-ghana-green text-white w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Proceed to Checkout
                </button>
                <Link
                  to="/shop"
                  className="btn-secondary border-ghana-green text-ghana-green w-full text-center"
                >
                  Continue Shopping
                </Link>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-start gap-2">
                  <span className="text-ghana-green font-bold mt-0.5">✓</span>
                  <span>Secure checkout with Paystack</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ghana-green font-bold mt-0.5">✓</span>
                  <span>Free returns within 30 days</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ghana-green font-bold mt-0.5">✓</span>
                  <span>Fast shipping across Ghana</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mt-16 pt-16 border-t border-gray-200 dark:border-gray-700"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-ghana-black dark:text-white mb-4">
            Don't Forget These Essentials
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Add matching items to complete your look
          </p>
          <Link to="/shop" className="btn-primary bg-ghana-green text-white inline-flex items-center gap-2">
            View More Products
            <ArrowRight size={20} />
          </Link>
        </div>
      </motion.section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { countAddresses } from '../../lib/account/addresses';

/**
 * Account Overview (Phase D3) — real data only.
 *
 * Shows the customer's name, email, profile completion, saved-address count
 * and current persistent cart count. Deliberately NO invented order counts,
 * loyalty points, spend or membership tier — those systems do not exist.
 */

export function AccountOverview() {
  const { user, profile, profileError, refreshProfile } = useAuth();
  const { itemCount } = useCart();

  const [addressCount, setAddressCount] = useState<number | null>(null);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    countAddresses(userId)
      .then((count) => {
        if (!cancelled) setAddressCount(count);
      })
      .catch((err) => {
        // Overview degrades gracefully — the Addresses page reports load errors.
        console.error('Address count failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const displayName = profile?.fullName || user?.email?.split('@')[0] || 'there';

  const checks = [
    { label: 'Full name', done: Boolean(profile?.fullName), to: '/account/profile' },
    { label: 'Phone', done: Boolean(profile?.phone), to: '/account/profile' },
    { label: 'Saved address', done: (addressCount ?? 0) > 0, to: '/account/addresses' },
  ];
  const completed = checks.filter((check) => check.done).length;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="font-display text-4xl text-ghana-black sm:text-5xl dark:text-white">
        Hello, {displayName}
      </h1>
      <p className="mt-3 text-sm text-ghana-black/60 dark:text-white/60">
        Your details, saved addresses and cart — all in one place.
      </p>

      {profileError && (
        <div
          role="alert"
          className="mt-8 rounded-lg border border-ghana-black/10 p-5 text-sm text-ghana-black/70 dark:border-white/10 dark:text-white/70"
        >
          <p>{profileError}</p>
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="mt-3 text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            Try again
          </button>
        </div>
      )}

      {/* Real counts — addresses and cart */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-ghana-black/10 p-5 dark:border-white/10">
          <p className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
            Saved addresses
          </p>
          <p className="mt-2 font-display text-3xl text-ghana-black dark:text-white">
            {addressCount === null ? '—' : addressCount}
          </p>
          <Link
            to="/account/addresses"
            className="mt-3 inline-block text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            Manage addresses
          </Link>
        </div>

        <div className="rounded-lg border border-ghana-black/10 p-5 dark:border-white/10">
          <p className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
            Items in cart
          </p>
          <p className="mt-2 font-display text-3xl text-ghana-black dark:text-white">{itemCount}</p>
          <Link
            to="/cart"
            className="mt-3 inline-block text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            View cart
          </Link>
        </div>
      </div>

      {/* Profile completion — real fields only */}
      <div className="mt-6 rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-ghana-black dark:text-white">
            Profile completion
          </h2>
          <span className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
            {completed} of {checks.length} complete
          </span>
        </div>

        <ul className="mt-5 space-y-3 text-sm">
          {checks.map((check) => (
            <li
              key={check.label}
              className="flex items-center justify-between gap-4 border-b border-ghana-black/5 pb-3 last:border-0 last:pb-0 dark:border-white/5"
            >
              <span className="flex items-center gap-3 text-ghana-black dark:text-white">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${
                    check.done ? 'bg-ghana-green text-white' : 'bg-ghana-black/10 text-ghana-black/50 dark:bg-white/10 dark:text-white/50'
                  }`}
                  aria-hidden="true"
                >
                  {check.done ? <Check size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
                </span>
                {check.label}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/50 dark:text-white/50">
                {check.done ? 'Complete' : 'Add now'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          to="/shop"
          className="btn-primary bg-ghana-green text-white disabled:opacity-60"
        >
          Continue shopping
        </Link>
        <Link
          to="/account/profile"
          className="rounded-lg border border-ghana-black/15 px-5 py-3 text-xs uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white"
        >
          Manage profile
        </Link>
        <Link
          to="/account/addresses"
          className="rounded-lg border border-ghana-black/15 px-5 py-3 text-xs uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white"
        >
          Manage addresses
        </Link>
      </div>
    </motion.div>
  );
}

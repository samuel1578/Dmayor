/**
 * Money helpers for the F1 Edge Functions.
 *
 * Paystack expects the amount as an integer in the currency's minor unit
 * (GHS -> pesewas, so GHS 250.00 -> 25000). The amount ALWAYS comes from
 * `orders.total_amount` server-side and is converted without floating-point
 * multiplication: the decimal string is split and recombined with BigInt.
 */

/**
 * Minor-unit exponent per currency. Every currency this project supports on
 * Paystack uses 2 decimal places; unknown currencies default to 2.
 */
const MINOR_UNIT_EXPONENT: Record<string, number> = {
  GHS: 2,
  NGN: 2,
  USD: 2,
  ZAR: 2,
  KES: 2,
};

export function minorUnitExponent(currency: string): number {
  return MINOR_UNIT_EXPONENT[currency.toUpperCase()] ?? 2;
}

/**
 * Converts a non-negative decimal amount to the provider's integer minor units.
 * Throws for anything that is not a plain non-negative decimal — the caller
 * treats that as a server error, never a silent rounding.
 */
export function toMinorUnits(amount: string | number, currency: string): number {
  const exponent = minorUnitExponent(currency);
  const raw = (typeof amount === 'number' ? amount.toString() : amount).trim();

  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid amount: ${raw}`);
  }

  const [intPart, fracRaw = ''] = raw.split('.');
  // Keep `exponent` fraction digits and read one more for half-up rounding.
  const frac = fracRaw.padEnd(exponent + 1, '0');
  const kept = frac.slice(0, exponent);
  const nextDigit = Number(frac.charAt(exponent) || '0');

  let minor = BigInt(intPart + kept);
  if (nextDigit >= 5) minor += 1n;

  return Number(minor);
}

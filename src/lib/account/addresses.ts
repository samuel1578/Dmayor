import { supabase } from '../supabase';
import type { CustomerAddressRow } from '../supabase';

/**
 * Public data layer for the customer's saved addresses (Phase D3).
 *
 * Every helper is scoped to the signed-in user id (the session user — never a
 * browser-supplied identity) and is still authorized row-by-row by RLS
 * (`auth.uid() = user_id`). No payment, card or Paystack data is ever stored
 * here; addresses are delivery details only.
 *
 * Default handling: a partial unique index guarantees at most ONE default per
 * customer, so "set default" always unsets the current default first and only
 * then marks the selected row — never the other way around.
 */

export interface CustomerAddress {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string | null;
  country: string;
  postalCode: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Raw form state — every field is a string so inputs stay uncontrolled-free. */
export interface AddressInput {
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
}

export function emptyAddressInput(): AddressInput {
  return {
    label: '',
    recipientName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    country: 'Ghana',
    postalCode: '',
    isDefault: false,
  };
}

/**
 * Practical client-side validation — required: recipient name, phone,
 * address line 1, city, country. Postal code stays optional (Ghana) and no
 * external address verification is attempted.
 */
export function validateAddress(input: AddressInput): string | null {
  if (!input.recipientName.trim()) return 'Recipient name is required.';
  const phone = input.phone.trim();
  if (!phone) return 'Phone number is required.';
  if (!/^[0-9+()\s-]{6,20}$/.test(phone)) return 'Enter a valid phone number.';
  if (!input.addressLine1.trim()) return 'Address line 1 is required.';
  if (!input.city.trim()) return 'City is required.';
  if (!input.country.trim()) return 'Country is required.';
  return null;
}

/** Human copy for storage failures (default race, required fields, network). */
export function addressErrorMessage(error: unknown): string {
  const message = errorText(error).toLowerCase();
  if (message.includes('uq_customer_addresses_one_default')) {
    return 'Another address is already your default. Please try setting this one again.';
  }
  if (message.includes('customer_addresses_required_check')) {
    return 'Please fill in all the required fields.';
  }
  if (message.includes('fetch') || message.includes('network')) {
    return 'Network error — check your connection and try again.';
  }
  return 'We could not save your address. Please try again.';
}

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message ?? '');
  }
  return String(error ?? '');
}

function toFields(input: AddressInput) {
  return {
    label: input.label.trim() || null,
    recipient_name: input.recipientName.trim(),
    phone: input.phone.trim(),
    address_line1: input.addressLine1.trim(),
    address_line2: input.addressLine2.trim() || null,
    city: input.city.trim(),
    region: input.region.trim() || null,
    country: input.country.trim(),
    postal_code: input.postalCode.trim() || null,
    is_default: input.isDefault,
  };
}

function mapAddress(row: CustomerAddressRow): CustomerAddress {
  return {
    id: String(row.id),
    label: row.label ?? null,
    recipientName: String(row.recipient_name ?? ''),
    phone: String(row.phone ?? ''),
    addressLine1: String(row.address_line1 ?? ''),
    addressLine2: row.address_line2 ?? null,
    city: String(row.city ?? ''),
    region: row.region ?? null,
    country: String(row.country ?? 'Ghana'),
    postalCode: row.postal_code ?? null,
    isDefault: row.is_default === true,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

/** Unsets the customer's current default BEFORE a new one is written. */
async function unsetDefault(userId: string, exceptId?: string): Promise<void> {
  let query = supabase
    .from('customer_addresses')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true);

  if (exceptId) query = query.neq('id', exceptId);

  const { error } = await query;
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

/** Default address first, then oldest first. Scoped to the owner by RLS. */
export async function listAddresses(userId: string): Promise<CustomerAddress[]> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as CustomerAddressRow[]).map(mapAddress);
}

/** Lightweight count for the Account Overview (no row payload). */
export async function countAddresses(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('customer_addresses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return count ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export async function createAddress(userId: string, input: AddressInput): Promise<void> {
  if (input.isDefault) await unsetDefault(userId);
  const { error } = await supabase
    .from('customer_addresses')
    .insert({ user_id: userId, ...toFields(input) });
  if (error) throw error;
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: AddressInput,
): Promise<void> {
  if (input.isDefault) await unsetDefault(userId, addressId);
  const { error } = await supabase
    .from('customer_addresses')
    .update(toFields(input))
    .eq('user_id', userId)
    .eq('id', addressId);
  if (error) throw error;
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  const { error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('user_id', userId)
    .eq('id', addressId);
  if (error) throw error;
}

/**
 * Promotes an address to default: unset the current default first (the partial
 * unique index only allows one), then set the selected row.
 */
export async function setDefaultAddress(userId: string, addressId: string): Promise<void> {
  await unsetDefault(userId, addressId);
  const { error } = await supabase
    .from('customer_addresses')
    .update({ is_default: true })
    .eq('user_id', userId)
    .eq('id', addressId);
  if (error) throw error;
}

/**
 * Shipment & tracking helpers (Phase G1, refined in G3).
 *
 * Pure validation/presentation logic shared by the Admin shipment form and the
 * customer tracking display. Deliberately has NO Supabase runtime import (only
 * a type import), so it stays unit-testable in the node environment.
 *
 * Domain rules encoded here (mirrored server-side in migration 013):
 *   - all fields are optional/nullable; missing values are simply absent
 *   - carrier / tracking number / delivery note are trimmed text with a
 *     reasonable max length
 *   - a tracking URL, when present, must be a real http:// or https:// URL —
 *     javascript:, data: and every other scheme are rejected
 *   - no carrier enums exist: the carrier is free text until the business
 *     confirms a courier list
 *
 * Nothing here touches fulfilment status or payment status: saving shipment
 * details is independent of marking an order Shipped, in both directions.
 */

import type { OrderStatus } from './supabase';

/**
 * Non-blocking warning (Phase G3). Tracking is never required to ship an
 * order — some local delivery methods do not provide tracking numbers — so
 * this sentence is surfaced as a warning, never as a blocker.
 */
export const TRACKING_MISSING_WARNING = 'No tracking information has been added.';


/** Length limits — identical to the CHECK constraints in migration 013. */
export const SHIPMENT_LIMITS = {
  carrier: 120,
  trackingNumber: 120,
  trackingUrl: 500,
  deliveryNote: 500,
} as const;

/** The four shipment fields stored on an order (all nullable). */
export interface ShipmentFields {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  deliveryNote: string | null;
}

/** Raw form/edit values — always strings, before normalization. */
export interface ShipmentDraft {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  deliveryNote: string;
}

/** An empty shipment block: nothing to show, nothing to link to. */
export const EMPTY_SHIPMENT: ShipmentFields = {
  carrier: null,
  trackingNumber: null,
  trackingUrl: null,
  deliveryNote: null,
};

/** Trim a value and collapse blank/whitespace-only text to `null`. */
function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalizes raw edit values into stored values: trimmed, blanks → null.
 * Never truncates — length is enforced by the form (`maxLength`) and by the
 * database constraints, so an over-long value fails loudly instead of being
 * silently cut.
 */
export function normalizeShipmentInput(draft: Partial<ShipmentDraft>): ShipmentFields {
  return {
    carrier: normalizeText(draft.carrier),
    trackingNumber: normalizeText(draft.trackingNumber),
    trackingUrl: normalizeText(draft.trackingUrl),
    deliveryNote: normalizeText(draft.deliveryNote),
  };
}

export type TrackingUrlResult =
  | { ok: true; url: string | null }
  | { ok: false; message: string };

/**
 * Validates a tracking link. An empty value is valid and means "no link"
 * (the field is optional). A present value must start with http:// or https://
 * and contain no whitespace, and must parse as an absolute URL — `javascript:`,
 * `data:`, `file:`, `ftp:` and protocol-relative values are all rejected.
 *
 * The checks deliberately mirror the database rule in migration 013
 * (`^https?://[^[:space:]]+$`), so a value that passes here also passes there.
 */
export function validateTrackingUrl(raw: string | null | undefined): TrackingUrlResult {
  const value = normalizeText(raw);

  if (value === null) return { ok: true, url: null };

  if (value.length > SHIPMENT_LIMITS.trackingUrl) {
    return {
      ok: false,
      message: `Tracking link must be ${SHIPMENT_LIMITS.trackingUrl} characters or fewer.`,
    };
  }

  const rejected: TrackingUrlResult = {
    ok: false,
    message: 'Tracking link must be a valid http:// or https:// address (no spaces).',
  };

  // Mirror the database constraint: scheme first, no whitespace anywhere.
  if (/\s/.test(value) || !/^https?:\/\//i.test(value)) return rejected;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return rejected;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return rejected;

  return { ok: true, url: parsed.toString() };
}

/**
 * The URL that is safe to render as a link, or `null` when there is none or
 * it is not a valid http(s) address. Invalid schemes are never emitted, so a
 * bad stored value degrades to "no link" instead of a clickable `javascript:`.
 */
export function safeTrackingUrl(raw: string | null | undefined): string | null {
  const result = validateTrackingUrl(raw);
  return result.ok ? result.url : null;
}

/** True when at least one shipment value exists — drives all conditional UI. */
export function hasShipmentInfo(shipment: Partial<ShipmentFields> | null | undefined): boolean {
  if (!shipment) return false;
  return Boolean(
    normalizeText(shipment.carrier) ||
      normalizeText(shipment.trackingNumber) ||
      normalizeText(shipment.trackingUrl) ||
      normalizeText(shipment.deliveryNote),
  );
}

export interface TrackingCta {
  label: string;
  href: string;
}

/**
 * The customer "Track package" call to action, or `null` when it cannot be
 * shown safely (no tracking URL, or a stored URL with an invalid scheme).
 *
 * Visibility is NOT gated on fulfilment status: the Admin may save tracking
 * details before or after marking the order Shipped, and the customer sees
 * whatever shipment data exists on their own order.
 */
export function customerTrackingCta(
  shipment: Partial<ShipmentFields> | null | undefined,
): TrackingCta | null {
  if (!shipment) return null;
  const href = safeTrackingUrl(shipment.trackingUrl);
  if (!href) return null;
  return { label: 'Track package', href };
}

/**
 * Whether the customer should see shipment/tracking details (Phase G3).
 *
 * Tracking belongs to the Shipped stage: it is shown from the moment the order
 * has reached Shipped — by status, or by the recorded `shipped_at` timestamp so
 * a shipped-then-cancelled order keeps its tracking while an order that was
 * never shipped never shows tracking saved in advance.
 *
 * This is a display rule only: it never gates what an Admin may save, and it
 * never blocks marking an order Shipped (see `TRACKING_MISSING_WARNING`).
 */
export function showTrackingFor(
  status: OrderStatus,
  shippedAt?: string | null,
): boolean {
  if (typeof shippedAt === 'string' && shippedAt.trim().length > 0) return true;
  return status === 'shipped' || status === 'delivered';
}

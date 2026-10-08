import { describe, expect, it } from 'vitest';
import {
  SHIPMENT_LIMITS,
  customerTrackingCta,
  hasShipmentInfo,
  normalizeShipmentInput,
  safeTrackingUrl,
  validateTrackingUrl,
} from './shipment';

/**
 * Phase G1 — field validation and customer-facing tracking decisions.
 *
 * Covers required tests 5 (valid HTTPS accepted), 6 (invalid schemes
 * rejected), 9 (missing tracking renders cleanly) and 10 (shipped order with
 * tracking shows the customer tracking CTA), plus the trimming rules.
 */

describe('tracking URL validation', () => {
  it('accepts a valid HTTPS URL', () => {
    expect(validateTrackingUrl('https://track.example.com/JD0002')).toEqual({
      ok: true,
      url: 'https://track.example.com/JD0002',
    });
  });

  it('accepts a valid HTTP URL', () => {
    const result = validateTrackingUrl('http://courier.example/track/123');
    expect(result.ok).toBe(true);
  });

  it('treats a missing link as cleared — the field is optional', () => {
    expect(validateTrackingUrl('')).toEqual({ ok: true, url: null });
    expect(validateTrackingUrl('   ')).toEqual({ ok: true, url: null });
    expect(validateTrackingUrl(null)).toEqual({ ok: true, url: null });
    expect(validateTrackingUrl(undefined)).toEqual({ ok: true, url: null });
  });

  it('trims surrounding whitespace before validating', () => {
    const result = validateTrackingUrl('  https://track.example.com/JD0002  ');
    expect(result).toEqual({ ok: true, url: 'https://track.example.com/JD0002' });
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(document.cookie)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'file:///etc/passwd',
    'ftp://carrier.example/file',
    'vbscript:msgbox(1)',
    '//evil.example/tracking',
    'not a url',
    'track.example.com/JD0002',
    'https://exa mple.com/x',
    'http:/carrier.example/track',
  ])('rejects the unsafe or malformed link %s', (value) => {
    const result = validateTrackingUrl(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/https?:\/\//);
  });

  it('rejects a link longer than the database limit', () => {
    const tooLong = `https://track.example.com/${'x'.repeat(SHIPMENT_LIMITS.trackingUrl)}`;
    const result = validateTrackingUrl(tooLong);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(String(SHIPMENT_LIMITS.trackingUrl));
  });

  it('never exposes an invalid scheme as a renderable URL', () => {
    expect(safeTrackingUrl('javascript:alert(1)')).toBeNull();
    expect(safeTrackingUrl('data:text/html,x')).toBeNull();
    expect(safeTrackingUrl(null)).toBeNull();
    expect(safeTrackingUrl('https://track.example.com/ok')).toBe('https://track.example.com/ok');
  });
});

describe('shipment input normalization', () => {
  it('trims carrier, tracking number, link and delivery note', () => {
    expect(
      normalizeShipmentInput({
        carrier: '  DHL  ',
        trackingNumber: '  JD0002123  ',
        trackingUrl: '  https://track.example.com/JD0002123  ',
        deliveryNote: '  Leave at the front desk.  ',
      }),
    ).toEqual({
      carrier: 'DHL',
      trackingNumber: 'JD0002123',
      trackingUrl: 'https://track.example.com/JD0002123',
      deliveryNote: 'Leave at the front desk.',
    });
  });

  it('collapses blank and whitespace-only values to null (clears the field)', () => {
    expect(normalizeShipmentInput({ carrier: '   ', trackingNumber: '' })).toEqual({
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
      deliveryNote: null,
    });
  });

  it('accepts a partial draft without inventing values', () => {
    expect(normalizeShipmentInput({ carrier: 'GEX' })).toEqual({
      carrier: 'GEX',
      trackingNumber: null,
      trackingUrl: null,
      deliveryNote: null,
    });
  });
});

describe('customer shipment display', () => {
  it('missing tracking renders cleanly — nothing to show, nothing to link', () => {
    const empty = { carrier: null, trackingNumber: null, trackingUrl: null, deliveryNote: null };
    expect(hasShipmentInfo(empty)).toBe(false);
    expect(hasShipmentInfo(null)).toBe(false);
    expect(customerTrackingCta(empty)).toBeNull();
    // Whitespace-only stored values are treated as absent too.
    expect(hasShipmentInfo({ ...empty, carrier: '   ' })).toBe(false);
  });

  it('shows shipment details when they exist', () => {
    expect(
      hasShipmentInfo({ carrier: 'DHL', trackingNumber: null, trackingUrl: null, deliveryNote: null }),
    ).toBe(true);
    expect(
      hasShipmentInfo({ carrier: null, trackingNumber: null, trackingUrl: null, deliveryNote: 'Leave at gate' }),
    ).toBe(true);
  });

  it('shipped order with tracking shows the customer tracking CTA', () => {
    // Shipment data exactly as it lands on a shipped order after an Admin save.
    const shippedOrder = {
      carrier: 'DHL',
      trackingNumber: 'JD0002123456',
      trackingUrl: 'https://track.dhl.com/JD0002123456',
      deliveryNote: 'Leave at the front desk.',
    };

    expect(customerTrackingCta(shippedOrder)).toEqual({
      label: 'Track package',
      href: 'https://track.dhl.com/JD0002123456',
    });
    expect(hasShipmentInfo(shippedOrder)).toBe(true);
  });

  it('offers no CTA when the tracking link is missing or unsafe', () => {
    expect(
      customerTrackingCta({ carrier: 'DHL', trackingNumber: 'JD1', trackingUrl: null, deliveryNote: null }),
    ).toBeNull();
    expect(
      customerTrackingCta({
        carrier: 'DHL',
        trackingNumber: 'JD1',
        trackingUrl: 'javascript:alert(1)',
        deliveryNote: null,
      }),
    ).toBeNull();
  });
});

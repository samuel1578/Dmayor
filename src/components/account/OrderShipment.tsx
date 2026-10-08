import { Package } from 'lucide-react';
import { customerTrackingCta, hasShipmentInfo, type ShipmentFields } from '../../lib/shipment';

/**
 * Shipment / tracking block (Phase G1).
 *
 * Renders nothing when no shipment details have been saved, so an order
 * without tracking never shows empty labels. Values are read from the same
 * own-order RLS query as the rest of the order detail — a customer can only
 * ever see shipment data on their own orders, and can never write it.
 *
 * The "Track package" link is emitted only for a validated http(s) URL; an
 * invalid stored scheme degrades to no link rather than a clickable one, and
 * external links open with rel="noopener noreferrer".
 *
 * This is recorded shipment information, not a live courier feed: there is no
 * carrier API, no GPS and no map.
 */
export function OrderShipment({ shipment }: { shipment: ShipmentFields }) {
  if (!hasShipmentInfo(shipment)) return null;

  const cta = customerTrackingCta(shipment);

  return (
    <section
      aria-labelledby="order-shipment-heading"
      className="rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10"
    >
      <h2
        id="order-shipment-heading"
        className="flex items-center gap-2 font-display text-2xl text-ghana-black dark:text-white"
      >
        <Package size={20} aria-hidden="true" className="text-ghana-green" />
        Shipment
      </h2>
      <p className="mt-2 text-xs text-ghana-black/55 dark:text-white/55">
        Tracking details recorded on this order — not live courier tracking.
      </p>

      <dl className="mt-4 space-y-2 text-xs">
        {shipment.carrier && (
          <div className="flex justify-between gap-4">
            <dt className="text-ghana-black/50 dark:text-white/50">Carrier</dt>
            <dd className="text-right text-ghana-black/80 dark:text-white/80">
              {shipment.carrier}
            </dd>
          </div>
        )}
        {shipment.trackingNumber && (
          <div className="flex justify-between gap-4">
            <dt className="text-ghana-black/50 dark:text-white/50">Tracking number</dt>
            <dd className="break-all text-right font-mono text-ghana-black/80 dark:text-white/80">
              {shipment.trackingNumber}
            </dd>
          </div>
        )}
      </dl>

      {shipment.deliveryNote && (
        <p className="mt-4 border-t border-ghana-black/10 pt-4 text-sm text-ghana-black/70 dark:border-white/10 dark:text-white/70">
          Delivery note: {shipment.deliveryNote}
        </p>
      )}

      {cta && (
        <a
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ghana-black/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white dark:hover:border-ghana-green dark:hover:text-ghana-green"
        >
          {cta.label}
          <span aria-hidden="true">→</span>
        </a>
      )}
    </section>
  );
}

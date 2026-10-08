import type { jsPDF } from 'jspdf';
import {
  PAYMENT_STATUS_LABELS,
  customerStatusLabel,
  getMyOrder,
  type OrderDetail,
} from '../account/orders';

/**
 * Order invoice PDF (Phase E4).
 *
 * Generated on demand from the order record the customer can already read
 * through the normal RLS-protected query — nothing is cached, stored or sent
 * anywhere, and no service-role access is involved. Because the document is
 * built from CURRENT database state, an Admin changing payment or fulfilment
 * status is reflected the next time it is downloaded: nothing is generated or
 * stored during checkout.
 *
 * All values come from the order's SNAPSHOT columns (`order_items.product_name`,
 * size, colour, SKU, unit price, line total) plus the delivery snapshot — the
 * catalogue is never consulted, so the document stays true even if a product is
 * renamed, repriced, archived or its variant removed.
 *
 * Payment safety: the recorded payment status is printed as conspicuous TEXT
 * (never colour alone), and any document whose payment status is not `paid`
 * states plainly that it does not confirm payment.
 *
 * jsPDF is imported dynamically so the generator is only fetched when a
 * customer actually downloads a document (and the main bundle stays lean).
 */

/* -------------------------------------------------------------------------- */
/* Layout constants (A4 portrait, millimetres)                                */
/* -------------------------------------------------------------------------- */

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
const CONTENT_WIDTH = CONTENT_RIGHT - MARGIN;
const FOOTER_TOP = PAGE_HEIGHT - 24;

/** Brand gold — matches the storefront `ghana-green` accent. */
const GOLD: [number, number, number] = [184, 134, 11];
const RED: [number, number, number] = [206, 17, 38];
const INK: [number, number, number] = [17, 17, 17];
const MUTED: [number, number, number] = [110, 110, 110];
const RULE: [number, number, number] = [222, 222, 222];

/* -------------------------------------------------------------------------- */
/* Text helpers — jsPDF's standard fonts are ASCII-only                       */
/* -------------------------------------------------------------------------- */

const ASCII_MAP: ReadonlyArray<[string, string]> = [
  ['\u20B5', 'GHS '], // cedi sign
  ['\u2013', '-'],
  ['\u2014', '-'],
  ['\u2018', "'"],
  ['\u2019', "'"],
  ['\u201C', '"'],
  ['\u201D', '"'],
  ['\u2026', '...'],
  ['\u00B7', '-'],
  ['\u202F', ' '],
  ['\u00A0', ' '],
];

/** Keeps the PDF readable: no garbled glyphs from outside the ASCII range. */
function toPdfText(value: string | null | undefined): string {
  let text = String(value ?? '');
  for (const [from, to] of ASCII_MAP) text = text.split(from).join(to);
  return text.replace(/[^\x20-\x7E]/g, '?');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Deterministic ASCII date+time (locale-independent, so the PDF never varies). */
function pdfDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function money(value: number, currency: string): string {
  const amount = Number.isFinite(value) ? value : 0;
  const formatted = amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${toPdfText(currency)} ${formatted}`;
}

/** Stable, deterministic download name. */
export function invoiceFileName(orderNumber: string): string {
  return `${toPdfText(orderNumber)}-invoice.pdf`;
}

const NON_PAID_NOTE = 'This document does not confirm payment.';

function paymentBannerLines(order: OrderDetail): { headline: string; note: string } {
  const label = PAYMENT_STATUS_LABELS[order.paymentStatus].toUpperCase();

  switch (order.paymentStatus) {
    case 'paid':
      return {
        headline: `PAYMENT STATUS: ${label}`,
        note: 'This order is recorded as paid by The Proxy Shop.',
      };
    case 'failed':
      return {
        headline: `PAYMENT STATUS: ${label}`,
        note: `The last payment attempt did not go through. ${NON_PAID_NOTE}`,
      };
    case 'refunded':
      return {
        headline: `PAYMENT STATUS: ${label}`,
        note: `This order is recorded as refunded. ${NON_PAID_NOTE}`,
      };
    default:
      return { headline: `PAYMENT STATUS: ${label}`, note: NON_PAID_NOTE };
  }
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                    */
/* -------------------------------------------------------------------------- */

function drawRule(doc: jsPDF, y: number, color: [number, number, number] = RULE, width = 0.2) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(width);
  doc.line(MARGIN, y, CONTENT_RIGHT, y);
}

function drawHeader(doc: jsPDF, generatedAt: Date): number {
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('THE PROXY SHOP', MARGIN, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('Ghana', MARGIN, 26.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text('ORDER INVOICE', CONTENT_RIGHT, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Generated ${toPdfText(pdfDateTime(generatedAt.toISOString()))}`, CONTENT_RIGHT, 25, {
    align: 'right',
  });

  drawRule(doc, 30, GOLD, 0.6);
  return 38;
}

/** Payment state as conspicuous TEXT — never colour alone. */
function drawPaymentBanner(doc: jsPDF, order: OrderDetail, y: number): number {
  const { headline, note } = paymentBannerLines(order);
  const paid = order.paymentStatus === 'paid';
  const color = paid ? GOLD : RED;
  const height = 14;

  doc.setFillColor(paid ? 253 : 255, paid ? 250 : 245, paid ? 233 : 245);
  doc.rect(MARGIN, y, CONTENT_WIDTH, height, 'F');
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN, y, CONTENT_WIDTH, height, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(headline, MARGIN + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(note, MARGIN + 4, y + 11.5);

  return y + height + 9;
}

function drawOrderAndDelivery(doc: jsPDF, order: OrderDetail, y: number): number {
  const leftLabelX = MARGIN;
  const leftValueX = MARGIN + 34;
  const rightX = 116;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('ORDER', leftLabelX, y);
  doc.text('DELIVER TO', rightX, y);

  const rows: Array<[string, string]> = [
    ['Order number', order.orderNumber],
    ['Order date', pdfDateTime(order.createdAt)],
    ['Order status', customerStatusLabel(order.status)],
    ['Payment status', PAYMENT_STATUS_LABELS[order.paymentStatus]],
  ];

  let cursor = y + 6.5;
  doc.setFontSize(8.5);
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(toPdfText(label), leftLabelX, cursor);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(toPdfText(value), leftValueX, cursor);

    cursor += 5.6;
  }

  const leftBottom = cursor;

  // Delivery snapshot
  let rightCursor = y + 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(toPdfText(order.recipientName), rightX, rightCursor);
  rightCursor += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(toPdfText(order.phone), rightX, rightCursor);
  rightCursor += 4.6;

  const address = [
    order.addressLine1,
    order.addressLine2,
    order.city,
    order.region,
    order.postalCode,
    order.country,
  ].filter((part): part is string => Boolean(part && part.trim()));

  const addressLines = doc.splitTextToSize(toPdfText(address.join(', ')), CONTENT_RIGHT - rightX) as string[];
  doc.text(addressLines, rightX, rightCursor);
  rightCursor += addressLines.length * 4.6;

  return Math.max(leftBottom, rightCursor) + 8;
}

function drawItemsHeader(doc: jsPDF, y: number): number {
  const height = 8;

  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN, y, CONTENT_WIDTH, height, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('ITEM', MARGIN + 2, y + 5.4);
  doc.text('QTY', 112, y + 5.4, { align: 'right' });
  doc.text('UNIT PRICE', 156, y + 5.4, { align: 'right' });
  doc.text('LINE TOTAL', CONTENT_RIGHT - 2, y + 5.4, { align: 'right' });

  return y + height;
}

function drawItems(doc: jsPDF, order: OrderDetail, startY: number): number {
  let y = drawItemsHeader(doc, startY);
  const currency = order.currency;

  for (const item of order.items) {
    const nameLines = doc.splitTextToSize(toPdfText(item.productName), 88) as string[];
    const variantParts = [
      item.size ? `Size ${item.size}` : null,
      item.colour,
      item.variantSku ? `SKU ${item.variantSku}` : null,
    ].filter((part): part is string => Boolean(part));
    const variantLine = variantParts.length > 0 ? toPdfText(variantParts.join('  |  ')) : '';

    const rowHeight = nameLines.length * 4.6 + (variantLine ? 4.6 : 0) + 4.4;

    // Keep the row (and its totals) on one page.
    if (y + rowHeight > FOOTER_TOP - 60) {
      doc.addPage();
      y = drawItemsHeader(doc, MARGIN + 4);
    }

    let textY = y + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(nameLines, MARGIN + 2, textY);
    textY += nameLines.length * 4.6 - 4.6;

    if (variantLine) {
      textY += 4.6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(variantLine, MARGIN + 2, textY);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(String(item.quantity), 112, y + 6, { align: 'right' });
    doc.text(money(item.unitPrice, currency), 156, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(money(item.lineTotal, currency), CONTENT_RIGHT - 2, y + 6, { align: 'right' });

    y += rowHeight;
    drawRule(doc, y);
  }

  return y + 6;
}

function drawTotals(doc: jsPDF, order: OrderDetail, y: number): number {
  const labelX = 152;
  const valueX = CONTENT_RIGHT - 2;
  const rows: Array<[string, string]> = [
    ['Subtotal', money(order.subtotal, order.currency)],
    ['Delivery', money(order.shippingAmount, order.currency)],
  ];

  // Tax only when it applies to this order.
  if (order.taxAmount > 0) rows.push(['Tax', money(order.taxAmount, order.currency)]);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);

  let cursor = y + 4;
  for (const [label, value] of rows) {
    doc.text(label, labelX, cursor, { align: 'right' });
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(value, valueX, cursor, { align: 'right' });
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    cursor += 6;
  }

  cursor += 2;
  drawRule(doc, cursor - 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text('Total', labelX, cursor + 3, { align: 'right' });
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(money(order.totalAmount, order.currency), valueX, cursor + 3, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`All amounts in ${toPdfText(order.currency)}.`, valueX, cursor + 9, { align: 'right' });

  return cursor + 18;
}

function drawFooters(doc: jsPDF, order: OrderDetail) {
  const unpaid = order.paymentStatus !== 'paid';
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawRule(doc, FOOTER_TOP, RULE, 0.3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Generated from the order record held by The Proxy Shop.', MARGIN, FOOTER_TOP + 5);

    if (unpaid) {
      doc.setTextColor(RED[0], RED[1], RED[2]);
      doc.text(NON_PAID_NOTE, MARGIN, FOOTER_TOP + 9);
    }

    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      `${toPdfText(order.orderNumber)}  |  Page ${page} of ${pageCount}`,
      CONTENT_RIGHT,
      FOOTER_TOP + 5,
      { align: 'right' },
    );
  }
}

/** Builds the document. Exported for reuse/testing; pages use the helpers below. */
export async function buildOrderInvoicePdf(order: OrderDetail): Promise<jsPDF> {
  const { jsPDF: JsPdf } = await import('jspdf');

  const doc = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const generatedAt = new Date();

  let y = drawHeader(doc, generatedAt);
  y = drawPaymentBanner(doc, order, y);
  y = drawOrderAndDelivery(doc, order, y);
  y = drawItems(doc, order, y);
  drawTotals(doc, order, y);
  drawFooters(doc, order);

  return doc;
}

/**
 * Downloads the invoice for an order the caller has already loaded (and which
 * RLS already allowed them to read).
 */
export async function downloadOrderInvoice(order: OrderDetail): Promise<void> {
  const doc = await buildOrderInvoicePdf(order);
  doc.save(invoiceFileName(order.orderNumber));
}

/**
 * Convenience for lists: reads one order through the normal RLS-scoped query
 * and then downloads it. Never accepts order data from a URL parameter.
 */
export async function downloadOrderInvoiceByNumber(
  userId: string,
  orderNumber: string,
): Promise<void> {
  const order = await getMyOrder(userId, orderNumber);
  if (!order) throw new Error('That order is not available to download.');
  await downloadOrderInvoice(order);
}

/**
 * Server-side types shared by the F1 Edge Functions.
 *
 * These describe only what the functions read/write on the database. They are
 * deliberately separate from the client-safe response shapes (which never expose
 * a raw provider payload).
 */

export type PaymentAttemptStatus =
  | 'initialized'
  | 'pending'
  | 'success'
  | 'failed'
  | 'abandoned';

export interface OrderPaymentRow {
  id: string;
  order_number: string;
  user_id: string;
  status: string;
  payment_status: string;
  payment_source?: string | null;
  payment_reference?: string | null;
  payment_channel?: string | null;
  paid_at?: string | null;
  /** PostgREST returns numeric as a JSON number; tolerate a string too. */
  total_amount: number | string;
  currency: string;
}

export interface PaymentAttemptRow {
  id: string;
  order_id: string;
  user_id: string;
  provider: string;
  reference: string;
  status: PaymentAttemptStatus;
  amount: number | string;
  currency: string;
  channel: string | null;
  authorization_url: string | null;
  access_code: string | null;
  provider_response: unknown;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The safe client payload returned by initialize-payment. */
export interface InitializePaymentPayload {
  reference: string;
  authorizationUrl: string;
  attemptId: string;
}

/** The safe client payload returned by reconcile-payment (Admin only). */
export interface ReconcilePaymentPayload {
  status: 'paid' | 'unpaid';
  outcome: 'success' | 'already_verified' | 'failed' | 'abandoned' | 'pending';
  orderId: string;
  orderNumber: string;
  reference: string;
  amount: number;
  currency: string;
  channel: string | null;
  paidAt: string | null;
  /** The local attempt status after reconciliation. */
  attemptStatus: string | null;
}

/** The safe client payload returned by verify-payment. */
export interface VerifyPaymentPayload {
  /** The ORDER's payment state after verification — paid or still unpaid. */
  status: 'paid' | 'unpaid';
  /** The detailed attempt outcome (why it is paid or not). */
  outcome: 'success' | 'already_verified' | 'failed' | 'abandoned' | 'pending';
  reference: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  channel: string | null;
  paidAt: string | null;
}

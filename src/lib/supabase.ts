import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Supabase configuration error: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env (see .env.example). Do not commit real keys.',
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface ProductRow {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  price: number;
  category_id: string | null;
  /** Legacy JSON image URL list — storefront still reads this; prefer product_images long-term. */
  images: Json;
  /**
   * Legacy product-level stock — non-authoritative.
   * Authoritative inventory lives on product_variants.stock.
   */
  stock: number;
  featured: boolean;
  status: 'draft' | 'active' | 'archived';
  sku: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductInsert = {
  id?: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  price: number;
  category_id?: string | null;
  images?: Json;
  stock?: number;
  featured?: boolean;
  status?: 'draft' | 'active' | 'archived';
  sku?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProductUpdate = Partial<Omit<ProductRow, 'id'>> & { id?: string };

export interface ProductVariantRow {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  colour: string | null;
  stock: number;
  active: boolean;
  price_override: number | null;
  created_at: string;
  updated_at: string;
}

export type ProductVariantInsert = {
  id?: string;
  product_id: string;
  sku: string;
  size: string;
  colour?: string | null;
  stock?: number;
  active?: boolean;
  price_override?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type ProductVariantUpdate = Partial<Omit<ProductVariantRow, 'id'>> & { id?: string };

export interface ProductImageRow {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductImageInsert = {
  id?: string;
  product_id: string;
  image_url: string;
  alt_text?: string | null;
  display_order?: number;
  is_primary?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ProductImageUpdate = Partial<Omit<ProductImageRow, 'id'>> & { id?: string };

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_name: string | null;
  active: boolean;
  created_at: string;
}

export type CategoryInsert = {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  icon_name?: string | null;
  active?: boolean;
  created_at?: string;
};

export type CategoryUpdate = Partial<Omit<CategoryRow, 'id'>> & { id?: string };

export interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  featured_image: string | null;
  created_at: string;
}

export type CollectionInsert = {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  featured_image?: string | null;
  created_at?: string;
};

export type CollectionUpdate = Partial<Omit<CollectionRow, 'id'>> & { id?: string };

export interface BlogPostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featured_image: string | null;
  tags: string[];
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type BlogPostInsert = {
  id?: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  featured_image?: string | null;
  tags?: string[];
  published?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type BlogPostUpdate = Partial<Omit<BlogPostRow, 'id'>> & { id?: string };

export interface NewsletterSubscriberRow {
  id: string;
  email: string;
  subscribed: boolean;
  created_at: string;
}

export type NewsletterSubscriberInsert = {
  id?: string;
  email: string;
  subscribed?: boolean;
  created_at?: string;
};

export type NewsletterSubscriberUpdate = Partial<Omit<NewsletterSubscriberRow, 'id'>> & { id?: string };

export interface CollectionProductRow {
  id: string;
  collection_id: string;
  product_id: string;
  display_order: number;
  created_at: string;
}

export type CollectionProductInsert = {
  id?: string;
  collection_id: string;
  product_id: string;
  display_order?: number;
  created_at?: string;
};

export type CollectionProductUpdate = Partial<Omit<CollectionProductRow, 'id'>> & { id?: string };

export interface CustomerAddressRow {
  id: string;
  user_id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string | null;
  country: string;
  postal_code: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type CustomerAddressInsert = {
  id?: string;
  user_id: string;
  label?: string | null;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  region?: string | null;
  country?: string;
  postal_code?: string | null;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CustomerAddressUpdate = Partial<Omit<CustomerAddressRow, 'id'>> & { id?: string };

export type CartItemRow = {
  id: string;
  product_id: string;
  /** Phase D2: always set — a cart line is customer + product + exact variant. */
  variant_id: string;
  quantity: number;
  /** Phase D2: always set — auth.uid() ownership, FK to auth.users(id). */
  user_id: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CartItemInsert = {
  id?: string;
  product_id: string;
  variant_id: string;
  quantity?: number;
  user_id: string;
  session_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CartItemUpdate = Partial<Omit<CartItemRow, 'id'>> & { id?: string };

/** Phase E1: fulfilment status only — never merged with payment status. */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

/** Phase E1: payment domain. Nothing in the app writes anything but 'unpaid'. */
export type OrderPaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';

/**
 * Phase E1 order header. The delivery columns are a SNAPSHOT taken at checkout
 * — they are deliberately not a foreign key to `customer_addresses`, because a
 * saved address can later be edited or deleted and past orders must not move.
 * Totals are computed server-side by `create_order_from_cart()`.
 */
export interface OrderRow {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  payment_status: OrderPaymentStatus;
  subtotal: number;
  shipping_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string | null;
  country: string;
  postal_code: string | null;
  customer_note: string | null;
  /** Phase H0.1 payment metadata. `null` until a payment is recorded. */
  payment_reference: string | null;
  payment_provider: string | null;
  payment_channel: string | null;
  /** `manual` (written server-side today) or `paystack` (Phase F only). */
  payment_source: PaymentSource | null;
  /** When the payment state/metadata last changed — distinct from paid_at. */
  payment_updated_at: string | null;
  /** Set when the order is CURRENTLY marked paid (E3); null otherwise. */
  paid_at: string | null;
  /** Phase G2 cancellation lifecycle — null until the order is cancelled. */
  cancelled_at: string | null;
  /** Constrained reason code (see src/lib/cancellation.ts); nullable. */
  cancellation_reason: string | null;
  /** Internal Admin note — never selected by the customer order query. */
  cancellation_note: string | null;
  /** auth.uid() of the Admin who cancelled through admin_cancel_order(). */
  cancelled_by: string | null;
  /** Exactly-once restock marker: non-null only after stock was returned. */
  restocked_at: string | null;
  /** Phase G1 shipment fields — null until an Admin saves shipment details. */
  carrier: string | null;
  tracking_number: string | null;
  /** HTTP(S) only; any other scheme is rejected by the database constraint. */
  tracking_url: string | null;
  delivery_note: string | null;
  /** When the shipment block was last saved — current state, not an audit log. */
  tracking_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Phase H0.1: attribution for a recorded payment. */
export type PaymentSource = 'manual' | 'paystack';

/**
 * Phase F1: internal state of one external payment initialization. Deliberately
 * NOT a Paystack status — it is our own attempt lifecycle.
 */
export type PaymentAttemptStatus =
  | 'initialized'
  | 'pending'
  | 'success'
  | 'failed'
  | 'abandoned';

/**
 * Phase F1 payment attempt (one row per Paystack initialization/attempt).
 * Multiple attempts may exist per order; only the successful one becomes the
 * payment attribution. `provider_response` / `access_code` are server-only and
 * are not granted to customer sessions.
 */
export interface PaymentAttemptRow {
  id: string;
  order_id: string;
  user_id: string;
  provider: string;
  reference: string;
  status: PaymentAttemptStatus;
  amount: number;
  currency: string;
  channel: string | null;
  authorization_url: string | null;
  access_code: string | null;
  provider_response: Json | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Attempts are created only server-side (Edge Functions + service role). */
export type PaymentAttemptInsert = never;
export type PaymentAttemptUpdate = never;

/** Orders are created by the checkout RPC only — the browser never inserts one. */
export type OrderInsert = never;
/** Customers may not mutate orders (status, payment_status, totals, delete). */
export type OrderUpdate = never;

/**
 * Phase E1 order line. `product_name` / `variant_sku` / `size` / `colour` /
 * `unit_price` are the authoritative record of what was bought; `product_id`
 * and `variant_id` are nullable reporting links (`ON DELETE SET NULL`).
 */
export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  product_slug: string | null;
  variant_sku: string | null;
  size: string | null;
  colour: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  image_url: string | null;
  created_at: string;
}

export type OrderItemInsert = never;
export type OrderItemUpdate = never;

export type Database = {
  public: {
    Tables: {
      products: {
        Row: ProductRow;
        Insert: ProductInsert;
        Update: ProductUpdate;
      };
      product_variants: {
        Row: ProductVariantRow;
        Insert: ProductVariantInsert;
        Update: ProductVariantUpdate;
      };
      product_images: {
        Row: ProductImageRow;
        Insert: ProductImageInsert;
        Update: ProductImageUpdate;
      };
      categories: {
        Row: CategoryRow;
        Insert: CategoryInsert;
        Update: CategoryUpdate;
      };
      collections: {
        Row: CollectionRow;
        Insert: CollectionInsert;
        Update: CollectionUpdate;
      };
      collection_products: {
        Row: CollectionProductRow;
        Insert: CollectionProductInsert;
        Update: CollectionProductUpdate;
      };
      blog_posts: {
        Row: BlogPostRow;
        Insert: BlogPostInsert;
        Update: BlogPostUpdate;
      };
      newsletter_subscribers: {
        Row: NewsletterSubscriberRow;
        Insert: NewsletterSubscriberInsert;
        Update: NewsletterSubscriberUpdate;
      };
      cart_items: {
        Row: CartItemRow;
        Insert: CartItemInsert;
        Update: CartItemUpdate;
      };
      customer_addresses: {
        Row: CustomerAddressRow;
        Insert: CustomerAddressInsert;
        Update: CustomerAddressUpdate;
      };
      orders: {
        Row: OrderRow;
        Insert: OrderInsert;
        Update: OrderUpdate;
      };
      order_items: {
        Row: OrderItemRow;
        Insert: OrderItemInsert;
        Update: OrderItemUpdate;
      };
      payment_attempts: {
        Row: PaymentAttemptRow;
        Insert: PaymentAttemptInsert;
        Update: PaymentAttemptUpdate;
      };
    };
  };
};

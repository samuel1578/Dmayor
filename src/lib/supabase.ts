import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

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
  description: string | null;
  price: number;
  category_id: string | null;
  images: Json;
  stock: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export type ProductInsert = {
  id?: string;
  name: string;
  description?: string | null;
  price: number;
  category_id?: string | null;
  images?: Json;
  stock?: number;
  featured?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ProductUpdate = Partial<Omit<ProductRow, 'id'>> & { id?: string };

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_name: string | null;
  created_at: string;
}

export type CategoryInsert = {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  icon_name?: string | null;
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

export interface CartItemRow {
  id: string;
  product_id: string;
  quantity: number;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CartItemInsert = {
  id?: string;
  product_id: string;
  quantity?: number;
  session_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CartItemUpdate = Partial<Omit<CartItemRow, 'id'>> & { id?: string };

export type Database = {
  public: {
    Tables: {
      products: {
        Row: ProductRow;
        Insert: ProductInsert;
        Update: ProductUpdate;
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
    };
  };
};

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

/**
 * One cart interface with two internal sources (Phase D2):
 *
 *   Guest            → localStorage (`cart` key) — never sent to the database.
 *   Logged-in customer → Supabase `cart_items`, scoped by RLS to auth.uid().
 *
 * Components only ever see this context: addItem / updateQuantity / removeItem /
 * clearCart / total / itemCount behave the same regardless of source. The
 * database stores identity only (user + product + variant + quantity); name,
 * price, image and stock are always resolved from the live catalogue, so cart
 * display can never go stale.
 *
 * Login merge: a guest cart is validated against the live catalogue, merged
 * into the account cart by productId + variantId, clamped to current variant
 * stock, upserted — and only after that succeeds is the localStorage cart
 * cleared. If anything fails, the guest cart stays on the device untouched.
 */

const STORAGE_KEY = 'cart';

/**
 * A cart line is always Product + exact Product Variant.
 * Identity is `productId:variantId`, so the same product in two sizes or
 * colours stays two separate lines.
 */
export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  productSlug: string | null;
  productName: string;
  size: string;
  colour: string | null;
  sku: string | null;
  /** Effective unit price (variant price_override when set). */
  price: number;
  quantity: number;
  image: string | null;
  /** Variant stock, refreshed when the cart is revalidated. */
  stock: number;
  available: boolean;
  note: string | null;
}

export interface AddToCartInput {
  productId: string;
  variantId: string;
  productSlug?: string | null;
  productName: string;
  size: string;
  colour?: string | null;
  sku?: string | null;
  price: number;
  quantity?: number;
  image?: string | null;
  /** Current variant stock — quantity can never exceed it. */
  stock: number;
}

export interface CartActionResult {
  ok: boolean;
  message?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (input: AddToCartInput) => CartActionResult;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => CartActionResult;
  clearCart: () => void;
  /** Sum of available lines only — unavailable lines cannot be purchased. */
  total: number;
  itemCount: number;
  unavailableCount: number;
  revalidating: boolean;
  /**
   * True while the active cart source is resolving: the session is still
   * known, or the account cart is loading/merging. `items` is empty during
   * this window, so the navbar badge never shows a stale guest count while
   * the authenticated cart is loading.
   */
  loading: boolean;
  /** One-off message (merge outcome, legacy lines dropped, save failures). */
  cartNotice: string | null;
  dismissNotice: () => void;
  revalidateCart: () => Promise<void>;
  /**
   * Reloads the authenticated cart from the database. Used after checkout:
   * the order RPC clears the cart server-side, so this makes the UI (and the
   * navbar badge) reflect the committed state instead of guessing.
   */
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const lineId = (productId: string, variantId: string) => `${productId}:${variantId}`;

const SAVE_FAILED_NOTICE =
  'Your last cart change could not be saved to your account — we refreshed the cart to match your account. Please try again.';

/* -------------------------------------------------------------------------- */
/* Guest persistence (localStorage)                                           */
/* -------------------------------------------------------------------------- */

/**
 * Reads the saved cart defensively. Legacy product-only lines (no `variantId`)
 * cannot be matched to an exact size/colour, so they are dropped rather than
 * guessed — nothing is silently substituted.
 */
function loadStoredCart(): { items: CartItem[]; notice: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], notice: null };

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { items: [], notice: null };

    const items: CartItem[] = [];
    let dropped = 0;

    for (const entry of parsed) {
      const line = normalizeStoredItem(entry);
      if (line) items.push(line);
      else dropped += 1;
    }

    return {
      items,
      notice:
        dropped > 0
          ? `${dropped} item${dropped === 1 ? '' : 's'} from an earlier cart could not be matched to a size or variant and ${
              dropped === 1 ? 'was' : 'were'
            } removed. Please add ${dropped === 1 ? 'it' : 'them'} again from the product page.`
          : null,
    };
  } catch (err) {
    console.error('Could not read the saved cart:', err);
    return { items: [], notice: null };
  }
}

function normalizeStoredItem(entry: unknown): CartItem | null {
  if (!entry || typeof entry !== 'object') return null;

  const raw = entry as Record<string, unknown>;
  const productId = typeof raw.productId === 'string' ? raw.productId : null;
  const variantId =
    typeof raw.variantId === 'string' && raw.variantId.length > 0 ? raw.variantId : null;
  const quantity = Number(raw.quantity);
  const price = Number(raw.price);

  if (!productId || !variantId) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(price) || price < 0) return null;

  const stock = Number(raw.stock);
  const rounded = Math.floor(quantity);

  return {
    id: lineId(productId, variantId),
    productId,
    variantId,
    productSlug:
      typeof raw.productSlug === 'string'
        ? raw.productSlug
        : typeof raw.slug === 'string'
          ? raw.slug
          : null,
    productName: typeof raw.productName === 'string' ? raw.productName : 'Product',
    size: typeof raw.size === 'string' ? raw.size : '',
    colour: typeof raw.colour === 'string' ? raw.colour : null,
    sku: typeof raw.sku === 'string' ? raw.sku : null,
    price,
    quantity: rounded,
    image: typeof raw.image === 'string' ? raw.image : null,
    stock: Number.isFinite(stock) && stock > 0 ? Math.floor(stock) : rounded,
    available: raw.available === false ? false : true,
    note: typeof raw.note === 'string' ? raw.note : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Revalidation (shared by both sources)                                      */
/* -------------------------------------------------------------------------- */

interface ProductSnapshot {
  id: string;
  name: string;
  slug: string | null;
  price: number;
  status: string;
}

interface VariantSnapshot {
  id: string;
  size: string;
  colour: string | null;
  sku: string;
  stock: number;
  active: boolean;
  priceOverride: number | null;
}

function reconcileLine(
  item: CartItem,
  products: Map<string, ProductSnapshot>,
  variants: Map<string, VariantSnapshot>,
): CartItem {
  const product = products.get(item.productId);
  const variant = variants.get(item.variantId);

  // Variant stock and active flags stay authoritative: a missing or inactive
  // product/variant means removed, archived or deactivated — never silently
  // swapped for another variant.
  if (!product || product.status !== 'active' || !variant || !variant.active) {
    return { ...item, available: false, note: 'No longer available' };
  }

  const notes: string[] = [];
  const stock = Math.max(0, Math.floor(variant.stock));
  const price = variant.priceOverride ?? product.price;

  if (price !== item.price) notes.push('Price updated');

  let quantity = item.quantity;
  const available = stock > 0;

  if (!available) {
    notes.push('Out of stock');
  } else if (quantity > stock) {
    quantity = stock;
    notes.push(`Only ${stock} left`);
  }

  return {
    ...item,
    productName: product.name || item.productName,
    productSlug: product.slug ?? item.productSlug,
    size: variant.size || item.size,
    colour: variant.colour,
    sku: variant.sku || item.sku,
    price,
    stock,
    quantity,
    available,
    note: notes.length > 0 ? notes.join(' · ') : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Account cart (Supabase cart_items) — load                                  */
/* -------------------------------------------------------------------------- */

type EmbedRow = Record<string, unknown>;

/**
 * One consolidated relation select for the whole account cart:
 * cart rows → product → product images, plus the exact variant. Never one
 * query per cart line (no N+1). RLS on products / product_variants /
 * product_images already hides anything inactive from non-admin shoppers; the
 * active flags are checked in code as well (mirroring the catalogue layer).
 */
const CART_SELECT =
  'id, product_id, variant_id, quantity, created_at, ' +
  'product:products(id, name, slug, price, status, images, ' +
  'product_images(image_url, is_primary, display_order)), ' +
  'variant:product_variants(id, product_id, size, colour, sku, stock, active, price_override)';

function asRow(value: unknown): EmbedRow | null {
  return value && typeof value === 'object' ? (value as EmbedRow) : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/** Primary product image, with the legacy `products.images` list as fallback. */
function cartLineImage(product: EmbedRow | null): string | null {
  if (!product) return null;

  const embedded = Array.isArray(product.product_images)
    ? (product.product_images as unknown[]).map(asRow).filter((row): row is EmbedRow => row !== null)
    : [];

  const ordered = [...embedded].sort((a, b) => {
    const primaryDelta = Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary));
    if (primaryDelta !== 0) return primaryDelta;
    return asNumber(b.display_order) - asNumber(a.display_order);
  });

  for (const row of ordered) {
    const url = asText(row.image_url);
    if (url) return url;
  }

  const legacy = product.images;
  if (Array.isArray(legacy) && legacy.length > 0) {
    const first = legacy[0];
    if (typeof first === 'string') return first;
    const row = asRow(first);
    if (row) return asText(row.url);
  }

  return null;
}

/**
 * Maps account cart rows to display lines using embedded catalogue data only.
 * Rows whose product/variant is not visible (or no longer active, or whose
 * variant belongs to a different product) are kept as unavailable lines so the
 * customer can still see and remove them — nothing vanishes from the UI while
 * its row still exists in the database.
 */
function mapCustomerCartRows(data: unknown[]): CartItem[] {
  const rows = data.map(asRow).filter((row): row is EmbedRow => row !== null);

  const products = new Map<string, ProductSnapshot>();
  const variants = new Map<string, VariantSnapshot>();

  for (const row of rows) {
    const productId = asText(row.product_id);
    const product = asRow(row.product);
    if (productId && product) {
      products.set(productId, {
        id: productId,
        name: String(product.name ?? ''),
        slug: asText(product.slug),
        price: asNumber(product.price),
        status: String(product.status ?? 'active'),
      });
    }

    const variantId = asText(row.variant_id);
    const variant = asRow(row.variant);
    // Only register an exact product+variant pair — a mismatched pair can
    // never be treated as a real line (no substitution).
    if (variantId && variant && asText(variant.product_id) === productId) {
      variants.set(variantId, {
        id: variantId,
        size: String(variant.size ?? ''),
        colour: asText(variant.colour),
        sku: String(variant.sku ?? ''),
        stock: Math.max(0, Math.floor(asNumber(variant.stock))),
        active: variant.active !== false,
        priceOverride:
          variant.price_override === null || variant.price_override === undefined
            ? null
            : asNumber(variant.price_override),
      });
    }
  }

  const lines: CartItem[] = [];
  for (const row of rows) {
    const productId = asText(row.product_id);
    const variantId = asText(row.variant_id);
    if (!productId || !variantId) continue;

    const product = asRow(row.product);
    const productSnap = products.get(productId);
    // Unavailable when the pair is inconsistent — nothing is substituted.
    const variantSnap =
      variantProductOf(variants, row, productId, variantId) ?? undefined;

    const base: CartItem = {
      id: lineId(productId, variantId),
      productId,
      variantId,
      productSlug: productSnap?.slug ?? null,
      productName: productSnap?.name || 'Product',
      size: variantSnap?.size ?? '',
      colour: variantSnap?.colour ?? null,
      sku: variantSnap?.sku ?? null,
      // Effective price computed the same way the catalogue computes it, so
      // reconcile only reports "Price updated" when it genuinely changed.
      price: variantSnap?.priceOverride ?? productSnap?.price ?? 0,
      quantity: Math.max(1, Math.floor(asNumber(row.quantity, 1))),
      image: cartLineImage(product),
      stock: 0,
      available: true,
      note: null,
    };

    // Single shared reconcile pass: active flags, stock clamping and the
    // current effective price all come from the live catalogue.
    lines.push(reconcileLine(base, products, variants));
  }

  return lines;
}

/**
 * Returns the variant snapshot only when it belongs to the row's exact
 * product+variant pair (pair consistency is decided by the embed, not by the
 * row's product_id alone).
 */
function variantProductOf(
  variants: Map<string, VariantSnapshot>,
  row: EmbedRow,
  productId: string,
  variantId: string,
): VariantSnapshot | null {
  const embedded = asRow(row.variant);
  if (!embedded || asText(embedded.product_id) !== productId) return null;
  return variants.get(variantId) ?? null;
}

async function fetchCustomerCart(userId: string): Promise<CartItem[]> {
  const { data, error } = await supabase
    .from('cart_items')
    .select(CART_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return mapCustomerCartRows(data ?? []);
}

/* -------------------------------------------------------------------------- */
/* Account cart (Supabase cart_items) — writes                                */
/* -------------------------------------------------------------------------- */

/**
 * All writes are scoped by the caller's own identity (the session user id) and
 * are still authorized row-by-row by RLS (`auth.uid() = user_id`). The unique
 * (user_id, product_id, variant_id) constraint makes each write exactly one
 * line — never a duplicate.
 */
async function upsertCartLine(userId: string, item: CartItem): Promise<void> {
  const { error } = await supabase.from('cart_items').upsert(
    {
      user_id: userId,
      product_id: item.productId,
      variant_id: item.variantId,
      quantity: item.quantity,
    },
    { onConflict: 'user_id,product_id,variant_id' },
  );
  if (error) throw error;
}

async function updateCartLine(userId: string, item: CartItem): Promise<void> {
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity: item.quantity })
    .eq('user_id', userId)
    .eq('product_id', item.productId)
    .eq('variant_id', item.variantId);
  if (error) throw error;
}

async function deleteCartLine(userId: string, item: CartItem): Promise<void> {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', item.productId)
    .eq('variant_id', item.variantId);
  if (error) throw error;
}

async function clearAccountCart(userId: string): Promise<void> {
  const { error } = await supabase.from('cart_items').delete().eq('user_id', userId);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Login merge: guest cart → account cart                                     */
/* -------------------------------------------------------------------------- */

/**
 * Merges validated guest lines into the account cart:
 *
 *   1. load the authenticated database cart (quantities per identity)
 *   2. revalidate every guest line against the live catalogue
 *      (product active, exact variant active, variant belongs to the product,
 *       current stock)
 *   3. merged quantity = existing DB quantity + guest quantity, clamped to
 *      current variant stock
 *   4. single upsert on (user_id, product_id, variant_id) — no duplicate lines
 *
 * Throws on any failure so the caller can leave localStorage untouched.
 * Returns the number of guest lines that could not be moved (invalid /
 * unavailable) — those are never inserted and never substituted.
 */
async function mergeGuestIntoAccount(userId: string, guest: CartItem[]): Promise<number> {
  // 1. Authenticated database cart.
  const { data: dbRows, error: dbError } = await supabase
    .from('cart_items')
    .select('product_id, variant_id, quantity')
    .eq('user_id', userId);
  if (dbError) throw dbError;

  const dbQuantity = new Map<string, number>();
  for (const row of dbRows ?? []) {
    const typed = row as Record<string, unknown>;
    const productId = asText(typed.product_id);
    const variantId = asText(typed.variant_id);
    if (!productId || !variantId) continue;
    dbQuantity.set(lineId(productId, variantId), Math.max(0, Math.floor(asNumber(typed.quantity))));
  }

  // 2. Revalidate guest lines against the live catalogue (RLS exposes only
  //    active products/variants to non-admins; active flags checked below).
  const productIds = Array.from(new Set(guest.map((item) => item.productId)));
  const variantIds = Array.from(new Set(guest.map((item) => item.variantId)));

  const [productsRes, variantsRes] = await Promise.all([
    supabase.from('products').select('id, name, slug, price, status').in('id', productIds),
    supabase
      .from('product_variants')
      .select('id, product_id, size, colour, sku, stock, active, price_override')
      .in('id', variantIds),
  ]);
  if (productsRes.error) throw productsRes.error;
  if (variantsRes.error) throw variantsRes.error;

  const products = new Map<string, ProductSnapshot>();
  for (const row of (productsRes.data ?? []) as EmbedRow[]) {
    const id = asText(row.id);
    if (!id) continue;
    products.set(id, {
      id,
      name: String(row.name ?? ''),
      slug: asText(row.slug),
      price: asNumber(row.price),
      status: String(row.status ?? 'active'),
    });
  }

  const variants = new Map<string, VariantSnapshot>();
  // Exact-identity guard: a variant only counts for a guest line when it
  // actually belongs to that line's product.
  const variantProduct = new Map<string, string>();
  for (const row of (variantsRes.data ?? []) as EmbedRow[]) {
    const id = asText(row.id);
    if (!id) continue;
    const rowProductId = asText(row.product_id);
    if (rowProductId) variantProduct.set(id, rowProductId);
    variants.set(id, {
      id,
      size: String(row.size ?? ''),
      colour: asText(row.colour),
      sku: String(row.sku ?? ''),
      stock: Math.max(0, Math.floor(asNumber(row.stock))),
      active: row.active !== false,
      priceOverride:
        row.price_override === null || row.price_override === undefined
          ? null
          : asNumber(row.price_override),
    });
  }

  // 3. Validate + compute merged quantities.
  const upserts: {
    user_id: string;
    product_id: string;
    variant_id: string;
    quantity: number;
  }[] = [];
  let skipped = 0;

  for (const item of guest) {
    const product = products.get(item.productId);
    const variant = variants.get(item.variantId);

    const valid =
      product?.status === 'active' &&
      variant?.active === true &&
      // exact identity: the variant must belong to this product
      variantProduct.get(item.variantId) === item.productId;

    if (!valid || !variant) {
      skipped += 1;
      continue;
    }

    const stock = variant.stock;
    const merged = Math.min((dbQuantity.get(item.id) ?? 0) + Math.max(1, item.quantity), stock);

    // Out of stock (stock = 0) cannot be stored: quantity must stay > 0.
    if (merged <= 0) {
      skipped += 1;
      continue;
    }

    upserts.push({
      user_id: userId,
      product_id: item.productId,
      variant_id: item.variantId,
      quantity: merged,
    });
  }

  // 4. Persist the merged result. The caller clears the guest cart only
  //    after this succeeds.
  if (upserts.length > 0) {
    const { error } = await supabase
      .from('cart_items')
      .upsert(upserts, { onConflict: 'user_id,product_id,variant_id' });
    if (error) throw error;
  }

  return skipped;
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const userId = user?.id ?? null;

  const [initial] = useState(loadStoredCart);
  /** Guest cart — the only cart ever written to localStorage. */
  const [guestItems, setGuestItems] = useState<CartItem[]>(initial.items);
  /** Account cart — Supabase cart_items; never mirrored into localStorage. */
  const [customerItems, setCustomerItems] = useState<CartItem[]>([]);
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(initial.notice);
  const [revalidating, setRevalidating] = useState(false);

  const guestItemsRef = useRef(guestItems);
  guestItemsRef.current = guestItems;

  const currentUserIdRef = useRef<string | null>(userId);
  const flowRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);

  const loading = authLoading || (userId !== null && !customerLoaded);
  // Wrapped in useMemo so its identity only changes when the active source or
  // its data changes (keeps callback deps stable for the linter too).
  const items = useMemo(
    () => (loading ? [] : userId !== null ? customerItems : guestItems),
    [loading, userId, customerItems],
  );

  /* --------------------------- guest persistence -------------------------- */

  // The guest cart is always mirrored to localStorage. The merge clears it via
  // setGuestItems([]) only after the account cart has been persisted, so a
  // failed merge can never destroy it.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guestItems));
    } catch (err) {
      console.error('Could not save the cart to this device:', err);
    }
  }, [guestItems]);

  /* --------------------------- account cart I/O --------------------------- */

  const reloadCustomerCart = useCallback(async (uid: string): Promise<void> => {
    try {
      const rows = await fetchCustomerCart(uid);
      if (currentUserIdRef.current === uid) setCustomerItems(rows);
    } catch (err) {
      console.error('Could not reload the account cart:', err);
    }
  }, []);

  /** Failed account write: explain non-destructively and resync from the DB. */
  const handleSaveFailure = useCallback(
    (err: unknown, message: string) => {
      console.error('Account cart write failed:', err);
      setCartNotice(message);
      const uid = currentUserIdRef.current;
      if (uid) void reloadCustomerCart(uid);
    },
    [reloadCustomerCart],
  );

  const runWrite = useCallback(
    (operation: Promise<void>, message: string = SAVE_FAILED_NOTICE) => {
      void operation.catch((err: unknown) => handleSaveFailure(err, message));
    },
    [handleSaveFailure],
  );

  /**
   * The per-login cart flow: merge the guest cart (when one exists), then load
   * the canonical account cart from Supabase. Deduplicated per user id so React
   * strict-mode/effect re-runs and retries share one execution.
   */
  const runCartFlow = useCallback(
    (uid: string): Promise<void> => {
      const existing = flowRef.current;
      if (existing && existing.userId === uid) return existing.promise;

      const promise = (async () => {
        const guest = guestItemsRef.current;

        if (guest.length > 0) {
          try {
            const skipped = await mergeGuestIntoAccount(uid, guest);
            // Reached only after persistence succeeded — safe to clear.
            setGuestItems([]);
            if (skipped > 0) {
              setCartNotice(
                `${skipped} item${skipped === 1 ? '' : 's'} from your previous cart ${
                  skipped === 1 ? 'is' : 'are'
                } no longer available and could not be moved into your account cart.`,
              );
            }
          } catch (err) {
            // Merge failed: the guest cart stays in localStorage untouched.
            console.error('Guest → account cart merge failed:', err);
            setCartNotice(
              'We could not move your cart into your account just now — nothing was lost. Your cart is still saved on this device and will merge the next time you sign in.',
            );
          }
        }

        try {
          const rows = await fetchCustomerCart(uid);
          if (currentUserIdRef.current === uid) {
            setCustomerItems(rows);
            setCustomerLoaded(true);
          }
        } catch (err) {
          console.error('Could not load the account cart:', err);
          setCartNotice(
            (previous) =>
              [
                previous,
                'We could not load your account cart. Please refresh the page to try again.',
              ]
                .filter(Boolean)
                .join(' '),
          );
          if (currentUserIdRef.current === uid) setCustomerLoaded(true);
        }
      })();

      flowRef.current = { userId: uid, promise };
      void promise.finally(() => {
        if (flowRef.current?.promise === promise) flowRef.current = null;
      });
      return promise;
    },
    [],
  );

  /* ------------------------- source switching ----------------------------- */

  useEffect(() => {
    currentUserIdRef.current = userId;

    if (!userId) {
      // Signed out: switch the UI back to the guest cart. The account cart is
      // deliberately left in the database for the next login and is never
      // copied into localStorage (no account-state leakage on shared devices).
      flowRef.current = null;
      setCustomerItems([]);
      setCustomerLoaded(false);
      return;
    }

    setCustomerLoaded(false);
    void runCartFlow(userId);
  }, [userId, runCartFlow]);

  /* ------------------------------- actions -------------------------------- */

  const addItem = useCallback(
    (input: AddToCartInput): CartActionResult => {
      if (loading) {
        return { ok: false, message: 'Your cart is still loading — please try again in a moment.' };
      }

      const id = lineId(input.productId, input.variantId);

      if (!input.productId || !input.variantId) {
        return { ok: false, message: 'Choose a size before adding this item.' };
      }

      const stock = Math.max(0, Math.floor(input.stock));
      if (stock <= 0) {
        return { ok: false, message: 'That option is out of stock.' };
      }

      const requested = Math.max(1, Math.floor(input.quantity ?? 1));
      const existing = items.find((item) => item.id === id);
      const wanted = (existing?.quantity ?? 0) + requested;
      const quantity = Math.min(wanted, stock);
      const limited = quantity < wanted;

      const next: CartItem = {
        id,
        productId: input.productId,
        variantId: input.variantId,
        productSlug: input.productSlug ?? existing?.productSlug ?? null,
        productName: input.productName,
        size: input.size,
        colour: input.colour ?? null,
        sku: input.sku ?? null,
        price: input.price,
        quantity,
        image: input.image ?? existing?.image ?? null,
        stock,
        available: true,
        note: limited ? `Only ${stock} left` : null,
      };

      const nextItems = existing
        ? items.map((item) => (item.id === id ? next : item))
        : [...items, next];

      if (userId) {
        setCustomerItems(nextItems);
        runWrite(upsertCartLine(userId, next));
      } else {
        setGuestItems(nextItems);
      }

      return limited
        ? { ok: true, message: `Only ${stock} in stock — quantity limited to ${stock}.` }
        : { ok: true };
    },
    [items, loading, userId, runWrite],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      const line = items.find((item) => item.id === itemId);
      const nextItems = items.filter((item) => item.id !== itemId);

      if (userId) {
        setCustomerItems(nextItems);
        if (line) runWrite(deleteCartLine(userId, line));
      } else {
        setGuestItems(nextItems);
      }
    },
    [items, userId, runWrite],
  );

  const updateQuantity = useCallback(
    (itemId: string, quantity: number): CartActionResult => {
      const line = items.find((item) => item.id === itemId);
      if (!line) return { ok: false, message: 'That item is no longer in your cart.' };

      const commit = (nextLine: CartItem) => {
        const nextItems = items.map((item) => (item.id === itemId ? nextLine : item));
        if (userId) {
          setCustomerItems(nextItems);
          runWrite(updateCartLine(userId, nextLine));
        } else {
          setGuestItems(nextItems);
        }
      };

      if (quantity <= 0) {
        const nextItems = items.filter((item) => item.id !== itemId);
        if (userId) {
          setCustomerItems(nextItems);
          runWrite(deleteCartLine(userId, line));
        } else {
          setGuestItems(nextItems);
        }
        return { ok: true };
      }

      if (quantity > line.stock) {
        commit({ ...line, quantity: line.stock, note: `Only ${line.stock} left` });
        return { ok: false, message: `Only ${line.stock} available for this option.` };
      }

      commit({ ...line, quantity });
      return { ok: true };
    },
    [items, userId, runWrite],
  );

  const clearCart = useCallback(() => {
    if (userId) {
      setCustomerItems([]);
      runWrite(clearAccountCart(userId));
    } else {
      setGuestItems([]);
    }
  }, [userId, runWrite]);

  const dismissNotice = useCallback(() => {
    setCartNotice(null);
  }, []);

  const refreshCart = useCallback(async () => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    await reloadCustomerCart(uid);
  }, [reloadCustomerCart]);

  /**
   * Re-checks every saved line against the live catalogue: product still
   * active, variant still active, stock and current effective price. When the
   * account cart has not loaded yet (e.g. a failed load), this retries the
   * login flow instead. Clamped account quantities are written back so the
   * database never keeps an over-stock quantity. Failures leave the last known
   * state untouched rather than falsely flagging the whole cart.
   */
  const revalidateCart = useCallback(async () => {
    if (userId && !customerLoaded) {
      await runCartFlow(userId);
      return;
    }

    const snapshot = items;
    if (snapshot.length === 0) return;

    setRevalidating(true);

    try {
      const productIds = Array.from(new Set(snapshot.map((item) => item.productId)));
      const variantIds = Array.from(new Set(snapshot.map((item) => item.variantId)));

      const [productsRes, variantsRes] = await Promise.all([
        supabase.from('products').select('id, name, slug, price, status').in('id', productIds),
        supabase
          .from('product_variants')
          .select('id, size, colour, sku, stock, price_override, active')
          .in('id', variantIds),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (variantsRes.error) throw variantsRes.error;

      const products = new Map<string, ProductSnapshot>();
      for (const row of productsRes.data ?? []) {
        products.set(String(row.id), {
          id: String(row.id),
          name: String(row.name ?? ''),
          slug: (row.slug as string | null) ?? null,
          price: Number(row.price ?? 0),
          status: String(row.status ?? 'active'),
        });
      }

      const variants = new Map<string, VariantSnapshot>();
      for (const row of variantsRes.data ?? []) {
        variants.set(String(row.id), {
          id: String(row.id),
          size: String(row.size ?? ''),
          colour: (row.colour as string | null) ?? null,
          sku: String(row.sku ?? ''),
          stock: Number(row.stock ?? 0),
          active: row.active !== false,
          priceOverride:
            row.price_override === null || row.price_override === undefined
              ? null
              : Number(row.price_override),
        });
      }

      const reconciled = snapshot.map((item) => reconcileLine(item, products, variants));

      if (userId) {
        setCustomerItems(reconciled);
        // Persist any stock clamp so the database quantity stays truthful.
        // (Reconcile only ever lowers a quantity, never raises it.)
        for (const item of reconciled) {
          const before = snapshot.find((line) => line.id === item.id);
          if (before && item.quantity !== before.quantity) {
            runWrite(updateCartLine(userId, item));
          }
        }
      } else {
        setGuestItems(reconciled);
      }
    } catch (err) {
      console.error('Could not re-check the cart against the catalogue:', err);
    } finally {
      setRevalidating(false);
    }
  }, [items, userId, customerLoaded, runCartFlow, runWrite]);

  /* -------------------------------- derived ------------------------------- */

  const total = items.reduce(
    (sum, item) => sum + (item.available ? item.price * item.quantity : 0),
    0,
  );
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const unavailableCount = items.reduce((count, item) => count + (item.available ? 0 : 1), 0);

  const value = useMemo<CartContextType>(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      total,
      itemCount,
      unavailableCount,
      revalidating,
      loading,
      cartNotice,
      dismissNotice,
      revalidateCart,
      refreshCart,
    }),
    [
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      total,
      itemCount,
      unavailableCount,
      revalidating,
      loading,
      cartNotice,
      dismissNotice,
      revalidateCart,
      refreshCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

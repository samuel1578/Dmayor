import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  listProducts,
  loadProductEditor,
  setProductStatus,
  type AdminProductListItem,
  type ProductStatus,
} from '../../lib/admin/products';
import { describeError } from '../../lib/admin/errors';
import { getPublishBlockers, verifyImageLoads } from '../../lib/admin/validation';
import { formatAdminDate, formatCedis, statusLabels } from '../../lib/admin/format';

type StatusFilter = 'all' | ProductStatus;

const statusStyles: Record<ProductStatus, string> = {
  draft: 'border-ghana-black/20 dark:border-white/25 text-ghana-black/70 dark:text-white/70',
  active: 'border-ghana-green text-ghana-green',
  archived: 'border-ghana-red/60 text-ghana-red',
};

interface Feedback {
  status: 'saved' | 'error';
  message: string;
}

export function AdminProducts() {
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [pendingArchive, setPendingArchive] = useState<AdminProductListItem | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      setProducts(await listProducts());
    } catch (err) {
      setLoadError(describeError(err, 'Could not load the catalogue.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: products.length,
      draft: 0,
      active: 0,
      archived: 0,
    };
    for (const product of products) base[product.status] += 1;
    return base;
  }, [products]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      if (statusFilter !== 'all' && product.status !== statusFilter) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        (product.slug ?? '').toLowerCase().includes(term) ||
        (product.sku ?? '').toLowerCase().includes(term)
      );
    });
  }, [products, search, statusFilter]);

  const handleStatusChange = async (
    item: AdminProductListItem,
    next: ProductStatus,
    successMessage: string,
  ) => {
    setBusyId(item.id);
    setFeedback(null);

    try {
      await setProductStatus(item.id, next);
      setFeedback({ status: 'saved', message: successMessage });
      await refresh();
    } catch (err) {
      setFeedback({ status: 'error', message: describeError(err, 'Could not update the product.') });
    } finally {
      setBusyId(null);
      setPendingArchive(null);
    }
  };

  const handlePublish = async (item: AdminProductListItem) => {
    setBusyId(item.id);
    setFeedback(null);

    try {
      const data = await loadProductEditor(item.id);
      if (!data) throw new Error('That product is no longer available.');

      const primary =
        data.images.find((image) => image.isPrimary) ?? data.images[0] ?? null;
      const resolves = primary ? await verifyImageLoads(primary.imageUrl) : false;

      const blockers = getPublishBlockers({
        name: data.product.name,
        slug: data.product.slug ?? '',
        categoryId: data.product.categoryId,
        price: String(data.product.price),
        sku: data.product.sku ?? '',
        images: data.images,
        variants: data.variants,
        primaryImageResolves: resolves,
      });

      if (blockers.length > 0) {
        throw new Error(`Cannot publish ${item.name}: ${blockers.join(' ')}`);
      }

      await setProductStatus(item.id, 'active');
      setFeedback({ status: 'saved', message: `${item.name} published.` });
      await refresh();
    } catch (err) {
      setFeedback({ status: 'error', message: describeError(err, 'Could not publish this product.') });
    } finally {
      setBusyId(null);
    }
  };

  const renderActions = (item: AdminProductListItem) => {
    const busy = busyId === item.id;

    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={`/admin/products/${item.id}`}
          className="text-xs uppercase tracking-[0.14em] text-ghana-black dark:text-white hover:text-ghana-green"
        >
          Edit
        </Link>

        {item.status !== 'active' && (
          <button
            type="button"
            onClick={() => handlePublish(item)}
            disabled={busy}
            className="text-xs uppercase tracking-[0.14em] text-ghana-green hover:text-ghana-black dark:hover:text-white disabled:opacity-50"
          >
            Publish
          </button>
        )}

        {item.status === 'active' && (
          <button
            type="button"
            onClick={() => handleStatusChange(item, 'draft', `${item.name} moved back to draft.`)}
            disabled={busy}
            className="text-xs uppercase tracking-[0.14em] text-ghana-black/70 dark:text-white/70 hover:text-ghana-green disabled:opacity-50"
          >
            Unpublish
          </button>
        )}

        {item.status === 'archived' ? (
          <button
            type="button"
            onClick={() => handleStatusChange(item, 'draft', `${item.name} restored to draft.`)}
            disabled={busy}
            className="text-xs uppercase tracking-[0.14em] text-ghana-black/70 dark:text-white/70 hover:text-ghana-green disabled:opacity-50"
          >
            Restore
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPendingArchive(item)}
            disabled={busy}
            className="text-xs uppercase tracking-[0.14em] text-ghana-red hover:text-ghana-black dark:hover:text-white disabled:opacity-50"
          >
            Archive
          </button>
        )}
      </div>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-3">Catalogue</p>
          <h1 className="font-display text-4xl sm:text-5xl text-ghana-black dark:text-white">
            Products
          </h1>
          <p className="mt-3 text-sm text-ghana-black/60 dark:text-white/60">
            {counts.all} product{counts.all === 1 ? '' : 's'} · {counts.active} active ·{' '}
            {counts.draft} draft · {counts.archived} archived
          </p>
        </div>

        <Link
          to="/admin/products/new"
          className="flex items-center gap-2 px-5 py-3 rounded-lg bg-ghana-green text-white text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 hover:bg-ghana-black"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Create product
        </Link>
      </div>

      {loadError && (
        <p role="alert" className="mt-6 text-sm text-ghana-red">
          {loadError}
        </p>
      )}

      {feedback && (
        <p
          role={feedback.status === 'error' ? 'alert' : 'status'}
          className={`mt-6 text-sm ${feedback.status === 'error' ? 'text-ghana-red' : 'text-ghana-green'}`}
        >
          {feedback.message}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative w-full sm:max-w-xs">
          <span className="sr-only">Search products</span>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghana-black/40 dark:text-white/40"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, slug or SKU"
            className="input-field pl-9"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'active', 'archived'] as StatusFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-2 rounded-lg border text-[10px] uppercase tracking-[0.16em] transition-colors duration-200 ${
                statusFilter === filter
                  ? 'border-ghana-green text-ghana-green'
                  : 'border-ghana-black/15 dark:border-white/20 text-ghana-black/60 dark:text-white/60 hover:border-ghana-green'
              }`}
            >
              {filter === 'all' ? 'All' : statusLabels[filter]} ({counts[filter]})
            </button>
          ))}
        </div>
      </div>

      {visibleProducts.length === 0 ? (
        <p className="mt-10 text-sm text-ghana-black/60 dark:text-white/60">
          {products.length === 0
            ? 'No products yet. Create your first draft to get started.'
            : 'No products match this filter.'}
        </p>
      ) : (
        <>
          {/* Desktop list */}
          <div className="hidden md:block mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.16em] text-ghana-black/50 dark:text-white/50">
                  <th className="text-left font-normal pb-3 pr-4">Product</th>
                  <th className="text-left font-normal pb-3 pr-4">Category</th>
                  <th className="text-right font-normal pb-3 pr-4">Price</th>
                  <th className="text-left font-normal pb-3 pr-4">Status</th>
                  <th className="text-left font-normal pb-3 pr-4">Featured</th>
                  <th className="text-right font-normal pb-3 pr-4">Stock</th>
                  <th className="text-right font-normal pb-3 pr-4">Variants</th>
                  <th className="text-left font-normal pb-3 pr-4">Updated</th>
                  <th className="text-left font-normal pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-ghana-black/10 dark:border-white/10 align-top"
                  >
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-lg object-cover border border-ghana-black/10 dark:border-white/10"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-ghana-black/5 dark:bg-white/5 border border-ghana-black/10 dark:border-white/10" />
                        )}
                        <div className="min-w-0">
                          <p className="text-ghana-black dark:text-white font-medium truncate max-w-[16rem]">
                            {item.name}
                          </p>
                          <p className="text-xs text-ghana-black/50 dark:text-white/50 truncate max-w-[16rem]">
                            {item.slug ? `/${item.slug}` : 'No slug'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-ghana-black/70 dark:text-white/70">
                      {item.categoryName ?? '—'}
                    </td>
                    <td className="py-4 pr-4 text-right text-ghana-black dark:text-white">
                      {formatCedis(item.price)}
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={`text-[10px] uppercase tracking-[0.16em] border rounded-full px-3 py-1 whitespace-nowrap ${statusStyles[item.status]}`}
                      >
                        {statusLabels[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-ghana-black/70 dark:text-white/70">
                      {item.featured ? 'Yes' : '—'}
                    </td>
                    <td className="py-4 pr-4 text-right text-ghana-black dark:text-white">
                      {item.variantCount === 0 ? '0 / incomplete' : item.totalStock}
                    </td>
                    <td className="py-4 pr-4 text-right text-ghana-black/70 dark:text-white/70">
                      {item.activeVariantCount}/{item.variantCount}
                    </td>
                    <td className="py-4 pr-4 text-ghana-black/60 dark:text-white/60 whitespace-nowrap">
                      {formatAdminDate(item.updatedAt)}
                    </td>
                    <td className="py-4">{renderActions(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden mt-8 space-y-4">
            {visibleProducts.map((item) => (
              <div
                key={item.id}
                className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-4"
              >
                <div className="flex gap-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-lg object-cover border border-ghana-black/10 dark:border-white/10"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-ghana-black/5 dark:bg-white/5 border border-ghana-black/10 dark:border-white/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-ghana-black dark:text-white font-medium truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-ghana-black/50 dark:text-white/50 truncate">
                      {item.slug ? `/${item.slug}` : 'No slug'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] uppercase tracking-[0.16em] border rounded-full px-3 py-1 ${statusStyles[item.status]}`}
                      >
                        {statusLabels[item.status] ?? item.status}
                      </span>
                      <span className="text-xs text-ghana-black dark:text-white">
                        {formatCedis(item.price)}
                      </span>
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-ghana-black/60 dark:text-white/60">
                  <div>
                    <dt className="uppercase tracking-[0.14em] text-[10px]">Category</dt>
                    <dd>{item.categoryName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.14em] text-[10px]">Stock</dt>
                    <dd>{item.variantCount === 0 ? '0 / incomplete' : item.totalStock}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.14em] text-[10px]">Variants</dt>
                    <dd>
                      {item.activeVariantCount}/{item.variantCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.14em] text-[10px]">Featured</dt>
                    <dd>{item.featured ? 'Yes' : '—'}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-[0.14em] text-[10px]">Updated</dt>
                    <dd>{formatAdminDate(item.updatedAt)}</dd>
                  </div>
                </dl>

                <div className="mt-4 border-t border-ghana-black/10 dark:border-white/10 pt-3">
                  {renderActions(item)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={pendingArchive !== null}
        title="Archive product"
        message={`${pendingArchive?.name ?? 'This product'} is kept in the database with all images and variants, but stops appearing on the storefront.`}
        confirmLabel="Archive"
        danger
        busy={busyId === pendingArchive?.id}
        onConfirm={() =>
          pendingArchive &&
          handleStatusChange(pendingArchive, 'archived', `${pendingArchive.name} archived.`)
        }
        onCancel={() => setPendingArchive(null)}
      />
    </div>
  );
}

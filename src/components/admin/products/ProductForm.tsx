import type { CategoryRecord } from '../../../lib/admin/products';
import { slugify, type GeneralFormValues } from '../../../lib/admin/validation';
import { formatCedis } from '../../../lib/admin/format';

interface ProductFormProps {
  mode: 'create' | 'edit';
  values: GeneralFormValues;
  categories: CategoryRecord[];
  onChange: (patch: Partial<GeneralFormValues>) => void;
  disabled?: boolean;
}

const labelClass =
  'block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-2';

const hintClass = 'mt-1.5 text-xs text-ghana-black/50 dark:text-white/50';

export function ProductForm({ mode, values, categories, onChange, disabled = false }: ProductFormProps) {
  const pricePreview = Number(values.price);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="product-name" className={labelClass}>
          Name
        </label>
        <input
          id="product-name"
          type="text"
          value={values.name}
          disabled={disabled}
          onChange={(e) => onChange({ name: e.target.value })}
          className="input-field"
          placeholder="Heritage Linen Shirt"
        />
      </div>

      <div>
        <label htmlFor="product-slug" className={labelClass}>
          Slug
        </label>
        <input
          id="product-slug"
          type="text"
          value={values.slug}
          disabled={disabled}
          onChange={(e) => onChange({ slug: e.target.value })}
          onBlur={() => {
            const normalised = slugify(values.slug);
            // Only normalise (and lock) the slug when the Admin actually changed it.
            if (normalised !== values.slug) onChange({ slug: normalised });
          }}
          className="input-field"
          placeholder="heritage-linen-shirt"
        />
        <p className={hintClass}>Lowercase kebab-case. Generated from the name until you edit it.</p>
      </div>

      <div>
        <label htmlFor="product-sku" className={labelClass}>
          Product SKU
        </label>
        <input
          id="product-sku"
          type="text"
          value={values.sku}
          disabled={disabled}
          onChange={(e) => onChange({ sku: e.target.value })}
          className="input-field"
          placeholder="TPS-SHIRT-001"
        />
        <p className={hintClass}>Required before publishing. Must be unique.</p>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="product-description" className={labelClass}>
          Description
        </label>
        <textarea
          id="product-description"
          rows={4}
          value={values.description}
          disabled={disabled}
          onChange={(e) => onChange({ description: e.target.value })}
          className="input-field resize-y"
          placeholder="Fabric, fit and finish notes."
        />
      </div>

      <div>
        <label htmlFor="product-category" className={labelClass}>
          Category
        </label>
        <select
          id="product-category"
          value={values.categoryId ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ categoryId: e.target.value || null })}
          className="input-field"
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="product-price" className={labelClass}>
          Base Price (GHS)
        </label>
        <input
          id="product-price"
          type="text"
          inputMode="decimal"
          value={values.price}
          disabled={disabled}
          onChange={(e) => onChange({ price: e.target.value })}
          className="input-field"
          placeholder="0.00"
        />
        <p className={hintClass}>
          {Number.isNaN(pricePreview) ? 'Enter a number of 0 or more.' : `Displays as ${formatCedis(pricePreview)}`}
        </p>
      </div>

      <div>
        <span className={labelClass}>Status</span>
        {mode === 'create' ? (
          <>
            <select className="input-field" value="draft" disabled aria-label="Status">
              <option value="draft">Draft</option>
            </select>
            <p className={hintClass}>
              New products are always created as drafts. Add images and variants, then publish.
            </p>
          </>
        ) : (
          <select
            aria-label="Status"
            className="input-field"
            value={values.status}
            disabled={disabled}
            onChange={(e) => onChange({ status: e.target.value as GeneralFormValues['status'] })}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        )}
        {mode === 'edit' && (
          <p className={hintClass}>
            Setting Active here still runs the publish checks. Archived products stay in the database.
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={values.featured}
            disabled={disabled}
            onChange={(e) => onChange({ featured: e.target.checked })}
            className="mt-1 h-4 w-4 accent-ghana-green"
          />
          <span>
            <span className="block text-sm text-ghana-black dark:text-white">Featured</span>
            <span className="block text-xs text-ghana-black/50 dark:text-white/50">
              Featured pieces appear on the homepage once the product is active.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

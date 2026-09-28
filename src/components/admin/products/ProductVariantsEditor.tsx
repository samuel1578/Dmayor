import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { VariantDraft } from '../../../lib/admin/products';
import { ConfirmDialog } from '../ConfirmDialog';

const labelClass =
  'block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-1.5';

const emptyVariant = (): VariantDraft => ({
  id: null,
  size: '',
  colour: '',
  sku: '',
  stock: '0',
  priceOverride: '',
  active: true,
});

interface ProductVariantsEditorProps {
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
  disabled?: boolean;
}

export function ProductVariantsEditor({
  variants,
  onChange,
  disabled = false,
}: ProductVariantsEditorProps) {
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);

  const patchVariant = (index: number, patch: Partial<VariantDraft>) => {
    onChange(variants.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)));
  };

  const confirmRemove = () => {
    if (pendingRemove === null) return;
    onChange(variants.filter((_, i) => i !== pendingRemove));
    setPendingRemove(null);
  };

  const activeVariants = variants.filter((variant) => variant.active);
  const totalStock = activeVariants.reduce((sum, variant) => {
    const stock = Number(variant.stock);
    return sum + (Number.isNaN(stock) ? 0 : stock);
  }, 0);

  return (
    <div className="space-y-4">
      {variants.length === 0 ? (
        <p className="text-sm text-ghana-black/60 dark:text-white/60">
          No variants yet. Stock is tracked per variant, so a product needs at least one active
          variant before it can be published.
        </p>
      ) : (
        <div className="space-y-4">
          {variants.map((variant, index) => (
            <div
              key={variant.id ?? `new-variant-${index}`}
              className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-4"
            >
              <div className="grid gap-3 md:grid-cols-6">
                <div>
                  <label htmlFor={`variant-size-${index}`} className={labelClass}>
                    Size
                  </label>
                  <input
                    id={`variant-size-${index}`}
                    type="text"
                    value={variant.size}
                    disabled={disabled}
                    onChange={(e) => patchVariant(index, { size: e.target.value })}
                    className="input-field"
                    placeholder="M"
                  />
                </div>

                <div>
                  <label htmlFor={`variant-colour-${index}`} className={labelClass}>
                    Colour
                  </label>
                  <input
                    id={`variant-colour-${index}`}
                    type="text"
                    value={variant.colour}
                    disabled={disabled}
                    onChange={(e) => patchVariant(index, { colour: e.target.value })}
                    className="input-field"
                    placeholder="Sand"
                  />
                </div>

                <div>
                  <label htmlFor={`variant-sku-${index}`} className={labelClass}>
                    SKU
                  </label>
                  <input
                    id={`variant-sku-${index}`}
                    type="text"
                    value={variant.sku}
                    disabled={disabled}
                    onChange={(e) => patchVariant(index, { sku: e.target.value })}
                    className="input-field"
                    placeholder="TPS-SHIRT-001-M"
                  />
                </div>

                <div>
                  <label htmlFor={`variant-stock-${index}`} className={labelClass}>
                    Stock
                  </label>
                  <input
                    id={`variant-stock-${index}`}
                    type="text"
                    inputMode="numeric"
                    value={variant.stock}
                    disabled={disabled}
                    onChange={(e) => patchVariant(index, { stock: e.target.value })}
                    className="input-field"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label htmlFor={`variant-override-${index}`} className={labelClass}>
                    Price override
                  </label>
                  <input
                    id={`variant-override-${index}`}
                    type="text"
                    inputMode="decimal"
                    value={variant.priceOverride}
                    disabled={disabled}
                    onChange={(e) => patchVariant(index, { priceOverride: e.target.value })}
                    className="input-field"
                    placeholder="Optional"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 pb-3 text-sm text-ghana-black dark:text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={variant.active}
                      disabled={disabled}
                      onChange={(e) => patchVariant(index, { active: e.target.checked })}
                      className="h-4 w-4 accent-ghana-green"
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.18em] text-ghana-black/40 dark:text-white/40">
                  {variant.active ? 'Available publicly' : 'Inactive — hidden from the storefront'}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingRemove(index)}
                  disabled={disabled}
                  className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ghana-red hover:text-ghana-black dark:hover:text-white disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onChange([...variants, emptyVariant()])}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-ghana-black/15 dark:border-white/20 text-xs uppercase tracking-[0.16em] text-ghana-black dark:text-white transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green disabled:opacity-60"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add variant
        </button>
        <span className="text-xs text-ghana-black/50 dark:text-white/50">
          {activeVariants.length} active / {variants.length} total · total stock {totalStock}
        </span>
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove variant"
        message="This permanently deletes the variant when you save. Deactivate it instead if you only want to hide it from the storefront."
        confirmLabel="Remove variant"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}

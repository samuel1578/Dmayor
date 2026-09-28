import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';
import { ProductImagePlaceholder } from './ProductImagePlaceholder';

/** Normalized public shape (see `src/lib/catalogue/products.ts`). */
export interface QuickViewProduct {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  /** Normalized primary image from `product_images`. */
  image?: string | null;
  slug?: string | null;
  /** Derived from active `product_variants` stock. */
  available?: boolean;
}

interface QuickViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: QuickViewProduct;
}

/**
 * Lightweight summary only. Variant selection lives on the Product Detail
 * Page, which is the canonical purchase interface — this modal does not
 * duplicate that logic or claim availability it cannot verify.
 */
export function QuickViewModal({ isOpen, onClose, product }: QuickViewModalProps) {
  if (!product) return null;

  const detailPath = product.slug ? `/product/${product.slug}` : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${product.name} preview`}
            className="relative bg-white dark:bg-ghana-black rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
          >
            <div className="p-6 md:p-8">
              <button
                onClick={onClose}
                type="button"
                aria-label="Close quick view"
                className="absolute top-4 right-4 flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm font-semibold text-ghana-black shadow hover:bg-white dark:bg-gray-800/80 dark:text-white dark:hover:bg-gray-800"
              >
                <X size={18} />
                <span>Close</span>
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 md:mt-0">
                <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ProductImagePlaceholder />
                  )}
                </div>

                <div className="flex flex-col justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-ghana-black dark:text-white mb-4">
                      {product.name}
                    </h2>
                    <p className="text-3xl font-bold text-ghana-green mb-6">
                      ₵{product.price.toFixed(2)}
                    </p>
                    {product.description && (
                      <p className="text-ghana-black dark:text-gray-300 mb-6 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                    {typeof product.available === 'boolean' && (
                      <p
                        className={`mb-6 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                          product.available ? 'text-ghana-green' : 'text-ghana-red'
                        }`}
                      >
                        {product.available ? 'In stock' : 'Out of stock'}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      Sizes, colours and availability are shown on the product page.
                    </p>
                  </div>

                  {detailPath && (
                    <Link
                      to={detailPath}
                      onClick={onClose}
                      className="mt-8 w-full btn-primary bg-ghana-green text-white flex items-center justify-center gap-2 py-4"
                    >
                      View full details
                      <ArrowRight size={20} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

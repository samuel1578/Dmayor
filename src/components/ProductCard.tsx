import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ShoppingCart, Eye } from 'lucide-react';
import { useState } from 'react';
import { ProductImagePlaceholder } from './ProductImagePlaceholder';

/**
 * Normalized public product shape — provided by `src/lib/catalogue/products.ts`.
 * No legacy `products.images` / `products.stock` fields, no raw joins here.
 */
export interface ProductCardData {
  id: string;
  name: string;
  price: number;
  slug?: string | null;
  /** Normalized primary image from `product_images`. */
  image?: string | null;
  /** Derived from active `product_variants` stock. */
  available?: boolean;
  variantCount?: number;
  onQuickView?: () => void;
}

export function ProductCard({
  name,
  price,
  image,
  slug,
  available,
  onQuickView,
  variantCount,
}: ProductCardData) {
  const [isHovered, setIsHovered] = useState(false);
  const productPath = slug ? `/product/${slug}` : null;

  const handleQuickView = () => {
    if (onQuickView) {
      onQuickView();
    }
  };

  const media = image ? (
    <motion.img
      src={image}
      alt={name}
      className="w-full h-full object-cover"
      animate={{ scale: isHovered ? 1.1 : 1 }}
      transition={{ duration: 0.4 }}
    />
  ) : (
    <ProductImagePlaceholder />
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="card-product h-full group"
    >
      <div className="relative w-full h-64 md:h-80 overflow-hidden bg-gray-100 dark:bg-gray-800">
        {productPath ? (
          <Link
            to={productPath}
            aria-label={`View ${name}`}
            className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green"
          >
            {media}
          </Link>
        ) : (
          media
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleQuickView}
            className="btn-primary bg-white text-ghana-green hover:bg-ghana-yellow flex items-center gap-2"
            disabled={!onQuickView}
          >
            <Eye size={18} />
            Quick View
          </motion.button>
          {productPath && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                to={productPath}
                className="btn-secondary border-white text-white hover:bg-ghana-green hover:border-ghana-green flex items-center gap-2"
              >
                <ShoppingCart size={18} />
                Choose Options
              </Link>
            </motion.div>
          )}
        </motion.div>

        {available === false && (
          <span className="absolute top-3 left-3 rounded-full bg-ghana-black/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
            Out of stock
          </span>
        )}
      </div>

      <div className="p-4 md:p-6">
        <h3 className="text-lg font-semibold text-ghana-black dark:text-white mb-2 line-clamp-2 group-hover:text-ghana-green transition-colors">
          {productPath ? (
            <Link
              to={productPath}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghana-green rounded"
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-ghana-green">₵{price.toFixed(2)}</p>
          </div>
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="text-2xl text-ghana-yellow opacity-50 group-hover:opacity-100 transition-opacity"
          >
            ★
          </motion.div>
        </div>

        {variantCount !== undefined && variantCount > 1 && (
          <p className="text-xs text-gray-500 mt-2">{variantCount} variants available</p>
        )}

        <div className="mt-4 flex flex-col gap-2 md:hidden">
          <button
            onClick={handleQuickView}
            type="button"
            disabled={!onQuickView}
            className="btn-primary bg-ghana-green text-white flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Eye size={18} />
            Quick View
          </button>
          {productPath && (
            <Link
              to={productPath}
              className="btn-secondary border-ghana-green text-ghana-green flex items-center justify-center gap-2"
            >
              <ShoppingCart size={18} />
              Choose Options
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

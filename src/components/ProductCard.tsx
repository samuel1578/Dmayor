import { motion } from 'framer-motion';
import { ShoppingCart, Eye } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../contexts/CartContext';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image?: string;
  onQuickView?: () => void;
}

export function ProductCard({ id, name, price, image, onQuickView }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { addItem } = useCart();

  const handleAddToCart = () => {
    addItem({
      productId: id,
      productName: name,
      price,
      quantity: 1,
      image,
    });
  };

  const handleQuickView = () => {
    if (onQuickView) {
      onQuickView();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="card-product h-full group"
    >
      {/* Image Container */}
      <div className="relative w-full h-64 md:h-80 overflow-hidden bg-gray-100 dark:bg-gray-800">
        <motion.img
          src={image || 'https://images.pexels.com/photos/1055691/pexels-photo-1055691.jpeg?auto=compress&cs=tinysrgb&w=500'}
          alt={name}
          className="w-full h-full object-cover"
          animate={{ scale: isHovered ? 1.1 : 1 }}
          transition={{ duration: 0.4 }}
        />

        {/* Overlay Actions */}
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
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAddToCart}
            className="btn-secondary border-white text-white hover:bg-ghana-green hover:border-ghana-green flex items-center gap-2"
          >
            <ShoppingCart size={18} />
            Add to Cart
          </motion.button>
        </motion.div>
      </div>

      {/* Product Info */}
      <div className="p-4 md:p-6">
        <h3 className="text-lg font-semibold text-ghana-black dark:text-white mb-2 line-clamp-2 group-hover:text-ghana-green transition-colors">
          {name}
        </h3>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-ghana-green">
              ₵{price.toFixed(2)}
            </p>
          </div>
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="text-2xl text-ghana-yellow opacity-50 group-hover:opacity-100 transition-opacity"
          >
            ★
          </motion.div>
        </div>

        {/* Mobile Controls */}
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
          <button
            onClick={handleAddToCart}
            type="button"
            className="btn-secondary border-ghana-green text-ghana-green flex items-center justify-center gap-2"
          >
            <ShoppingCart size={18} />
            Add to Cart
          </button>
        </div>
      </div>
    </motion.div>
  );
}

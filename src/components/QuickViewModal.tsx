import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../contexts/CartContext';

interface QuickViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: {
    id: string;
    name: string;
    price: number;
    description?: string;
    image?: string;
  };
}

export function QuickViewModal({ isOpen, onClose, product }: QuickViewModalProps) {
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  if (!product) return null;

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity,
      image: product.image,
    });
    setQuantity(1);
    onClose();
  };

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
            className="relative bg-white dark:bg-ghana-black rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
          >
            <div className="p-6 md:p-8">
              {/* Close Button */}
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
                {/* Image */}
                <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <img
                    src={
                      product.image ||
                      'https://images.pexels.com/photos/1055691/pexels-photo-1055691.jpeg?auto=compress&cs=tinysrgb&w=500'
                    }
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Details */}
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

                    {/* Product Details */}
                    <div className="grid grid-cols-2 gap-4 mb-8 py-6 border-t border-b border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Material</p>
                        <p className="font-semibold text-ghana-black dark:text-white">100% Cotton</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Availability</p>
                        <p className="font-semibold text-ghana-green">In Stock</p>
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Add to Cart */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Quantity</p>
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="btn-icon text-ghana-black dark:text-white bg-gray-100 dark:bg-gray-800"
                        >
                          <Minus size={18} />
                        </button>
                        <span className="text-lg font-semibold text-ghana-black dark:text-white w-8 text-center">
                          {quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(quantity + 1)}
                          className="btn-icon text-ghana-black dark:text-white bg-gray-100 dark:bg-gray-800"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleAddToCart}
                      className="w-full btn-primary bg-ghana-green text-white flex items-center justify-center gap-2 py-4"
                    >
                      <ShoppingCart size={20} />
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

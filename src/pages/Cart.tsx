import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

export function Cart() {
  const { items, removeItem, updateQuantity, total, clearCart } = useCart();

  const shipping = items.length > 0 ? 50 : 0;
  const grandTotal = total + shipping;

  if (items.length === 0) {
    return (
      <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen flex flex-col">
        <div className="flex-grow flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
              <ShoppingBag size={48} className="text-gray-400" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-ghana-black dark:text-white mb-4">
              Your Cart is Empty
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md">
              Start shopping and add some amazing D'Mayor pieces to your cart.
            </p>
            <Link to="/shop" className="btn-primary bg-ghana-green text-white inline-flex items-center gap-2">
              Continue Shopping
              <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 min-h-screen py-12 md:py-16">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-bold text-ghana-black dark:text-white flex items-center gap-3"
        >
          <ShoppingBag size={40} />
          Shopping Cart
        </motion.h1>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-ghana-black rounded-lg overflow-hidden"
            >
              <div className="border-b border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-bold text-ghana-black dark:text-white">
                  Items ({items.length})
                </h2>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-6 flex flex-col md:flex-row gap-6"
                  >
                    {/* Item Image */}
                    <div className="w-full md:w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                      <img
                        src={
                          item.image ||
                          'https://images.pexels.com/photos/1055691/pexels-photo-1055691.jpeg?auto=compress&cs=tinysrgb&w=200'
                        }
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Item Details */}
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold text-ghana-black dark:text-white mb-2">
                        {item.productName}
                      </h3>
                      <p className="text-2xl font-bold text-ghana-green mb-4">
                        ₵{item.price.toFixed(2)} each
                      </p>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <Minus size={18} className="text-ghana-green" />
                          </button>
                          <span className="px-4 font-semibold text-ghana-black dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <Plus size={18} className="text-ghana-green" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Price & Remove */}
                    <div className="flex flex-col items-end justify-between">
                      <p className="text-2xl font-bold text-ghana-black dark:text-white">
                        ₵{(item.price * item.quantity).toFixed(2)}
                      </p>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-ghana-red hover:bg-red-50 dark:hover:bg-red-900 dark:hover:bg-opacity-20 rounded-lg transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Clear Cart Button */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button
                  onClick={clearCart}
                  className="text-ghana-red hover:text-ghana-red hover:opacity-80 font-semibold transition-opacity"
                >
                  Clear Cart
                </button>
              </div>
            </motion.div>
          </div>

          {/* Order Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1"
          >
            <div className="bg-white dark:bg-ghana-black rounded-lg p-6 sticky top-24">
              <h2 className="text-lg font-bold text-ghana-black dark:text-white mb-6">
                Order Summary
              </h2>

              <div className="space-y-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>₵{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Shipping</span>
                  <span>₵{shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Tax (10%)</span>
                  <span>₵{(total * 0.1).toFixed(2)}</span>
                </div>
              </div>

              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-ghana-black dark:text-white">
                    Total
                  </span>
                  <span className="text-3xl font-bold text-ghana-green">
                    ₵{(grandTotal + total * 0.1).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <button className="btn-primary bg-ghana-green text-white w-full">
                  Proceed to Checkout
                </button>
                <Link
                  to="/shop"
                  className="btn-secondary border-ghana-green text-ghana-green w-full text-center"
                >
                  Continue Shopping
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-start gap-2">
                  <span className="text-ghana-green font-bold mt-0.5">✓</span>
                  <span>Secure checkout with Paystack</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ghana-green font-bold mt-0.5">✓</span>
                  <span>Free returns within 30 days</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-ghana-green font-bold mt-0.5">✓</span>
                  <span>Fast shipping across Ghana</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Related Products CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mt-16 pt-16 border-t border-gray-200 dark:border-gray-700"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-ghana-black dark:text-white mb-4">
            Don't Forget These Essentials
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Add matching accessories to complete your look
          </p>
          <Link to="/shop" className="btn-primary bg-ghana-green text-white inline-flex items-center gap-2">
            View More Products
            <ArrowRight size={20} />
          </Link>
        </div>
      </motion.section>
    </div>
  );
}

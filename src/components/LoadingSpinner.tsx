import { motion } from 'framer-motion';

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-ghana-light dark:bg-ghana-dark">
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-6xl text-ghana-green"
        >
          ★
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-20 h-20 border-2 border-ghana-yellow opacity-30 rounded-full animate-pulse" />
        </motion.div>
      </div>
    </div>
  );
}

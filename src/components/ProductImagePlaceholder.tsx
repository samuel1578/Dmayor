interface ProductImagePlaceholderProps {
  label?: string;
  className?: string;
}

/**
 * Neutral stand-in for a product with no normalized `product_images` row.
 * Deliberately not a stock photo — nothing fake is shown for real products.
 */
export function ProductImagePlaceholder({
  label = 'No image yet',
  className = '',
}: ProductImagePlaceholderProps) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 ${className}`}
    >
      <span aria-hidden="true" className="text-2xl text-ghana-green">
        ★
      </span>
      <span className="px-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em]">
        {label}
      </span>
    </div>
  );
}

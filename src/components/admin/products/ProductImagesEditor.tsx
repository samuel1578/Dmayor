import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ImageOff, Plus, Trash2 } from 'lucide-react';
import type { ImageDraft } from '../../../lib/admin/products';
import { describeImageUrlProblem, verifyImageLoads } from '../../../lib/admin/validation';
import { ConfirmDialog } from '../ConfirmDialog';

type PreviewState = 'empty' | 'checking' | 'ok' | 'error';

const labelClass =
  'block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-2';

interface ImageRowProps {
  image: ImageDraft;
  index: number;
  total: number;
  disabled: boolean;
  onPatch: (index: number, patch: Partial<ImageDraft>) => void;
  onSetPrimary: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRequestRemove: (index: number) => void;
}

function ImageRow({
  image,
  index,
  total,
  disabled,
  onPatch,
  onSetPrimary,
  onMove,
  onRequestRemove,
}: ImageRowProps) {
  const url = image.imageUrl.trim();
  const urlProblem = describeImageUrlProblem(image.imageUrl);
  const [preview, setPreview] = useState<PreviewState>(url ? 'checking' : 'empty');

  useEffect(() => {
    if (!url) {
      setPreview('empty');
      return;
    }
    if (urlProblem) {
      setPreview('error');
      return;
    }

    let active = true;
    setPreview('checking');

    void verifyImageLoads(url).then((ok) => {
      if (active) setPreview(ok ? 'ok' : 'error');
    });

    return () => {
      active = false;
    };
  }, [url, urlProblem]);

  const statusText =
    preview === 'empty'
      ? 'Paste a direct image URL'
      : preview === 'checking'
        ? 'Checking image…'
        : preview === 'ok'
          ? 'Image loaded'
          : urlProblem ?? 'Could not load this image URL.';

  return (
    <div className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-24 shrink-0">
          <div className="w-24 h-24 rounded-lg overflow-hidden border border-ghana-black/10 dark:border-white/10 bg-ghana-black/5 dark:bg-white/5 flex items-center justify-center">
            {preview === 'ok' ? (
              <img
                src={url}
                alt={image.altText || 'Product image preview'}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <ImageOff className="w-5 h-5 text-ghana-black/30 dark:text-white/30" aria-hidden="true" />
            )}
          </div>
          <p
            className={`mt-2 text-[10px] leading-snug ${
              preview === 'error'
                ? 'text-ghana-red'
                : preview === 'ok'
                  ? 'text-ghana-green'
                  : 'text-ghana-black/45 dark:text-white/45'
            }`}
          >
            {statusText}
          </p>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <label htmlFor={`image-url-${index}`} className={labelClass}>
              Image URL
            </label>
            <input
              id={`image-url-${index}`}
              type="url"
              value={image.imageUrl}
              disabled={disabled}
              onChange={(e) => onPatch(index, { imageUrl: e.target.value })}
              className="input-field"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div>
            <label htmlFor={`image-alt-${index}`} className={labelClass}>
              Alt text
            </label>
            <input
              id={`image-alt-${index}`}
              type="text"
              value={image.altText}
              disabled={disabled}
              onChange={(e) => onPatch(index, { altText: e.target.value })}
              className="input-field"
              placeholder="Describe the image"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-ghana-black dark:text-white cursor-pointer">
              <input
                type="radio"
                name="product-primary-image"
                checked={image.isPrimary}
                disabled={disabled}
                onChange={() => onSetPrimary(index)}
                className="accent-ghana-green"
              />
              Primary image
            </label>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onMove(index, -1)}
                disabled={disabled || index === 0}
                aria-label="Move image up"
                className="w-8 h-8 flex items-center justify-center rounded-full text-ghana-black dark:text-white hover:bg-ghana-green/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onMove(index, 1)}
                disabled={disabled || index === total - 1}
                aria-label="Move image down"
                className="w-8 h-8 flex items-center justify-center rounded-full text-ghana-black dark:text-white hover:bg-ghana-green/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <span className="ml-1 text-[10px] uppercase tracking-[0.18em] text-ghana-black/40 dark:text-white/40">
                Position {index + 1}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onRequestRemove(index)}
              disabled={disabled}
              className="ml-auto flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ghana-red hover:text-ghana-black dark:hover:text-white disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProductImagesEditorProps {
  images: ImageDraft[];
  onChange: (images: ImageDraft[]) => void;
  disabled?: boolean;
}

export function ProductImagesEditor({ images, onChange, disabled = false }: ProductImagesEditorProps) {
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);

  const patchImage = (index: number, patch: Partial<ImageDraft>) => {
    onChange(images.map((image, i) => (i === index ? { ...image, ...patch } : image)));
  };

  const setPrimary = (index: number) => {
    onChange(images.map((image, i) => ({ ...image, isPrimary: i === index })));
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;

    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addImage = () => {
    onChange([
      ...images,
      { id: null, imageUrl: '', altText: '', isPrimary: images.length === 0 },
    ]);
  };

  const confirmRemove = () => {
    if (pendingRemove === null) return;

    const next = images.filter((_, i) => i !== pendingRemove);
    const removedWasPrimary = images[pendingRemove]?.isPrimary ?? false;
    const normalised = removedWasPrimary && next.length > 0
      ? next.map((image, i) => ({ ...image, isPrimary: i === 0 }))
      : next;

    onChange(normalised);
    setPendingRemove(null);
  };

  const primaryCount = images.filter((image) => image.isPrimary).length;

  return (
    <div className="space-y-4">
      {images.length === 0 ? (
        <p className="text-sm text-ghana-black/60 dark:text-white/60">
          No images yet. Products need at least one image with a chosen primary before publishing.
        </p>
      ) : (
        <div className="space-y-4">
          {images.map((image, index) => (
            <ImageRow
              key={image.id ?? `new-image-${index}`}
              image={image}
              index={index}
              total={images.length}
              disabled={disabled}
              onPatch={patchImage}
              onSetPrimary={setPrimary}
              onMove={moveImage}
              onRequestRemove={setPendingRemove}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addImage}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-ghana-black/15 dark:border-white/20 text-xs uppercase tracking-[0.16em] text-ghana-black dark:text-white transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green disabled:opacity-60"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add image URL
        </button>
        <span className="text-xs text-ghana-black/50 dark:text-white/50">
          {images.length} image{images.length === 1 ? '' : 's'}
          {images.length > 0 ? ` · ${primaryCount === 1 ? '1 primary' : `${primaryCount} primary`}` : ''}
        </span>
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove image"
        message="This image will be removed from the product when you save the image list."
        confirmLabel="Remove image"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}

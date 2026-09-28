import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  AdminSection,
  SectionSaveBar,
  type SectionSaveStatus,
} from '../../components/admin/AdminSection';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { ProductForm } from '../../components/admin/products/ProductForm';
import { ProductImagesEditor } from '../../components/admin/products/ProductImagesEditor';
import { ProductVariantsEditor } from '../../components/admin/products/ProductVariantsEditor';
import { PublishPanel, type PublishFeedback } from '../../components/admin/products/PublishPanel';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  createProduct,
  listCategories,
  loadProductEditor,
  saveProductImages,
  saveProductVariants,
  setProductStatus,
  updateProduct,
  type AdminProductRecord,
  type CategoryRecord,
  type ImageDraft,
  type ProductStatus,
  type VariantDraft,
} from '../../lib/admin/products';
import { describeError } from '../../lib/admin/errors';
import {
  getGeneralFormError,
  getImageSaveError,
  getPublishBlockers,
  getVariantSaveError,
  slugify,
  verifyImageLoads,
  type GeneralFormValues,
} from '../../lib/admin/validation';
import { formatAdminDate, statusLabels } from '../../lib/admin/format';

const emptyGeneral: GeneralFormValues = {
  name: '',
  slug: '',
  description: '',
  categoryId: null,
  price: '',
  sku: '',
  featured: false,
  status: 'draft',
};

interface SectionState {
  status: SectionSaveStatus;
  message: string | null;
}

const idle: SectionState = { status: 'idle', message: null };
const idlePublish: PublishFeedback = { status: 'idle', message: null };

function toGeneralValues(product: AdminProductRecord): GeneralFormValues {
  return {
    name: product.name,
    slug: product.slug ?? '',
    description: product.description ?? '',
    categoryId: product.categoryId,
    price: String(product.price),
    sku: product.sku ?? '',
    featured: product.featured,
    status: product.status,
  };
}

export function AdminProductEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isCreate = !id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [product, setProduct] = useState<AdminProductRecord | null>(null);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);

  const [general, setGeneral] = useState<GeneralFormValues>(emptyGeneral);
  const [savedGeneral, setSavedGeneral] = useState<GeneralFormValues>(emptyGeneral);
  const [slugTouched, setSlugTouched] = useState(false);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [savedImages, setSavedImages] = useState<ImageDraft[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [savedVariants, setSavedVariants] = useState<VariantDraft[]>([]);

  const [generalState, setGeneralState] = useState<SectionState>(idle);
  const [imagesState, setImagesState] = useState<SectionState>(idle);
  const [variantsState, setVariantsState] = useState<SectionState>(idle);
  const [publishFeedback, setPublishFeedback] = useState<PublishFeedback>(idlePublish);
  const [publishing, setPublishing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  /* ---------------------------------------------------------------- loading */

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    // Section feedback is per-record, so it must not survive a route change
    // (e.g. right after a new draft is created and the editor switches to it).
    setGeneralState(idle);
    setImagesState(idle);
    setVariantsState(idle);
    setPublishFeedback(idlePublish);

    try {
      const categoryList = await listCategories();
      setCategories(categoryList);

      if (!id) {
        setLoading(false);
        return;
      }

      const data = await loadProductEditor(id);
      if (!data) {
        setLoadError('That product does not exist or is no longer available.');
        setLoading(false);
        return;
      }

      const nextGeneral = toGeneralValues(data.product);
      setProduct(data.product);
      setGeneral(nextGeneral);
      setSavedGeneral(nextGeneral);
      setSlugTouched(Boolean(data.product.slug));
      setImages(data.images);
      setSavedImages(data.images);
      setVariants(data.variants);
      setSavedVariants(data.variants);
    } catch (err) {
      setLoadError(describeError(err, 'Could not load this product.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* ------------------------------------------------------------ primary img */

  const primaryUrl = useMemo(() => {
    const primary =
      images.find((image) => image.isPrimary && image.imageUrl.trim()) ??
      images.find((image) => image.imageUrl.trim());
    return primary ? primary.imageUrl.trim() : '';
  }, [images]);

  const [primaryResolves, setPrimaryResolves] = useState<boolean | null>(null);

  useEffect(() => {
    if (!primaryUrl) {
      setPrimaryResolves(null);
      return;
    }

    let active = true;
    setPrimaryResolves(null);

    void verifyImageLoads(primaryUrl).then((ok) => {
      if (active) setPrimaryResolves(ok);
    });

    return () => {
      active = false;
    };
  }, [primaryUrl]);

  /* ------------------------------------------------------------------ dirty */

  const generalDirty = JSON.stringify(general) !== JSON.stringify(savedGeneral);
  const imagesDirty = JSON.stringify(images) !== JSON.stringify(savedImages);
  const variantsDirty = JSON.stringify(variants) !== JSON.stringify(savedVariants);
  const dirty = generalDirty || imagesDirty || variantsDirty;

  /* ----------------------------------------------------- publish readiness */

  const publishBlockers = useMemo(
    () =>
      getPublishBlockers({
        name: general.name,
        slug: general.slug || slugify(general.name),
        categoryId: general.categoryId,
        price: general.price,
        sku: general.sku,
        images,
        variants,
        primaryImageResolves: primaryUrl ? primaryResolves : null,
      }),
    [general, images, variants, primaryUrl, primaryResolves],
  );

  /* --------------------------------------------------------------- handlers */

  const handleGeneralChange = (patch: Partial<GeneralFormValues>) => {
    if (patch.slug !== undefined) setSlugTouched(true);

    setGeneral((prev) => {
      const next = { ...prev, ...patch };
      // Slug is only auto-derived while the Admin has never edited it.
      if (patch.name !== undefined && !slugTouched) next.slug = slugify(patch.name);
      return next;
    });

    setGeneralState(idle);
  };

  const handleSaveGeneral = async () => {
    const values: GeneralFormValues = {
      ...general,
      name: general.name.trim(),
      slug: (general.slug.trim() || slugify(general.name)).trim(),
      sku: general.sku.trim(),
    };

    const validationError = getGeneralFormError(values);
    if (validationError) {
      setGeneralState({ status: 'error', message: validationError });
      return;
    }

    if (values.status === 'active' && savedGeneral.status !== 'active') {
      if (dirty) {
        setGeneralState({
          status: 'error',
          message: 'Save the image and variant sections before setting the status to Active.',
        });
        return;
      }
      if (publishBlockers.length > 0) {
        setGeneralState({
          status: 'error',
          message: `Cannot publish yet: ${publishBlockers.join(' ')}`,
        });
        return;
      }
    }

    setGeneralState({ status: 'saving', message: null });

    try {
      const input = {
        name: values.name,
        slug: values.slug,
        description: values.description.trim(),
        categoryId: values.categoryId,
        price: Number(values.price),
        sku: values.sku || null,
        featured: values.featured,
        status: values.status,
      };

      if (!product) {
        const newId = await createProduct({ ...input, status: 'draft' });
        navigate(`/admin/products/${newId}`, { replace: true });
        return;
      }

      await updateProduct(product.id, input);
      setGeneral(values);
      setSavedGeneral(values);
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              name: values.name,
              slug: values.slug,
              description: values.description.trim(),
              categoryId: values.categoryId,
              price: Number(values.price),
              sku: values.sku || null,
              featured: values.featured,
              status: values.status,
            }
          : prev,
      );
      setGeneralState({ status: 'saved', message: 'General details saved.' });
    } catch (err) {
      setGeneralState({ status: 'error', message: describeError(err, 'Could not save this product.') });
    }
  };

  const handleSaveImages = async () => {
    if (!product) return;

    const validationError = getImageSaveError(images);
    if (validationError) {
      setImagesState({ status: 'error', message: validationError });
      return;
    }

    setImagesState({ status: 'saving', message: null });

    try {
      const saved = await saveProductImages(product.id, images);
      setImages(saved);
      setSavedImages(saved);
      setImagesState({ status: 'saved', message: 'Images saved and storefront images synced.' });
    } catch (err) {
      setImagesState({ status: 'error', message: describeError(err, 'Could not save the images.') });
    }
  };

  const handleSaveVariants = async () => {
    if (!product) return;

    const validationError = getVariantSaveError(variants);
    if (validationError) {
      setVariantsState({ status: 'error', message: validationError });
      return;
    }

    setVariantsState({ status: 'saving', message: null });

    try {
      const result = await saveProductVariants(product.id, variants);
      setVariants(result.variants);
      setSavedVariants(result.variants);
      setProduct((prev) => (prev ? { ...prev, stock: result.totalStock } : prev));
      setVariantsState({
        status: 'saved',
        message: `Variants saved. Total stock ${result.totalStock}.`,
      });
    } catch (err) {
      setVariantsState({ status: 'error', message: describeError(err, 'Could not save the variants.') });
    }
  };

  const applyStatus = async (next: ProductStatus, successMessage: string) => {
    if (!product) return;

    setPublishing(true);
    setPublishFeedback({ status: 'idle', message: null });

    try {
      await setProductStatus(product.id, next);
      setProduct((prev) => (prev ? { ...prev, status: next } : prev));
      setGeneral((prev) => ({ ...prev, status: next }));
      setSavedGeneral((prev) => ({ ...prev, status: next }));
      setPublishFeedback({ status: 'saved', message: successMessage });
    } catch (err) {
      setPublishFeedback({
        status: 'error',
        message: describeError(err, 'Could not update the product status.'),
      });
    } finally {
      setPublishing(false);
      setConfirmArchive(false);
    }
  };

  const handlePublish = async () => {
    if (!product) return;

    setPublishing(true);
    setPublishFeedback({ status: 'idle', message: null });

    try {
      // Re-verify the primary image at publish time rather than trusting state.
      const primary =
        images.find((image) => image.isPrimary && image.imageUrl.trim()) ??
        images.find((image) => image.imageUrl.trim());
      const resolves = primary ? await verifyImageLoads(primary.imageUrl.trim()) : false;

      const blockers = getPublishBlockers({
        name: general.name,
        slug: general.slug,
        categoryId: general.categoryId,
        price: general.price,
        sku: general.sku,
        images,
        variants,
        primaryImageResolves: resolves,
      });

      if (blockers.length > 0) {
        throw new Error(`Cannot publish yet: ${blockers.join(' ')}`);
      }

      await setProductStatus(product.id, 'active');
      setProduct((prev) => (prev ? { ...prev, status: 'active' } : prev));
      setGeneral((prev) => ({ ...prev, status: 'active' }));
      setSavedGeneral((prev) => ({ ...prev, status: 'active' }));
      setPublishFeedback({ status: 'saved', message: 'Published. The product is now publicly visible.' });
    } catch (err) {
      setPublishFeedback({
        status: 'error',
        message: describeError(err, 'Could not publish this product.'),
      });
    } finally {
      setPublishing(false);
    }
  };

  /* ----------------------------------------------------------------- render */

  if (loading) return <LoadingSpinner />;

  if (loadError) {
    return (
      <div className="max-w-xl">
        <p role="alert" className="text-sm text-ghana-red">
          {loadError}
        </p>
        <Link
          to="/admin/products"
          className="mt-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ghana-black/60 dark:text-white/60 hover:text-ghana-green"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <Link
        to="/admin/products"
        className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ghana-black/60 dark:text-white/60 hover:text-ghana-green transition-colors duration-200"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Products
      </Link>

      <header className="mt-6 mb-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-3">
          {isCreate ? 'New product' : 'Product editor'}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl text-ghana-black dark:text-white">
          {isCreate ? 'Create a draft' : product?.name || 'Untitled product'}
        </h1>
        {!isCreate && product && (
          <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ghana-black/50 dark:text-white/50">
            <span className="uppercase tracking-[0.18em] rounded-full border border-ghana-black/15 dark:border-white/20 px-3 py-1">
              {statusLabels[product.status] ?? product.status}
            </span>
            <span>{product.slug ? `/${product.slug}` : 'No slug yet'}</span>
            <span>Updated {formatAdminDate(product.updatedAt)}</span>
          </p>
        )}
      </header>

      <div className="space-y-8">
        <AdminSection
          title="General"
          description={
            isCreate
              ? 'Create the product as a draft first. Images, variants and publishing unlock as soon as it exists.'
              : 'Core catalogue details. Slug uniqueness and SKU conflicts are reported here.'
          }
        >
          <ProductForm
            mode={isCreate ? 'create' : 'edit'}
            values={general}
            categories={categories}
            onChange={handleGeneralChange}
            disabled={generalState.status === 'saving'}
          />
          <SectionSaveBar
            status={generalState.status}
            message={generalState.message}
            onSave={handleSaveGeneral}
            saveLabel={isCreate ? 'Create draft' : 'Save general'}
            hint={isCreate ? 'New products are always created as drafts.' : undefined}
          />
        </AdminSection>

        {!isCreate && (
          <>
            <AdminSection
              title="Images"
              description="Direct public image URLs only. Each URL is previewed before it is saved; exactly one image is primary."
            >
              <ProductImagesEditor
                images={images}
                onChange={(next) => {
                  setImages(next);
                  setImagesState(idle);
                }}
                disabled={imagesState.status === 'saving'}
              />
              <SectionSaveBar
                status={imagesState.status}
                message={imagesState.message}
                onSave={handleSaveImages}
                saveLabel="Save images"
                hint="Saving also updates the storefront image list."
              />
            </AdminSection>

            <AdminSection
              title="Variants & inventory"
              description="Variant stock is authoritative. Saving syncs the legacy product stock total."
            >
              <ProductVariantsEditor
                variants={variants}
                onChange={(next) => {
                  setVariants(next);
                  setVariantsState(idle);
                }}
                disabled={variantsState.status === 'saving'}
              />
              <SectionSaveBar
                status={variantsState.status}
                message={variantsState.message}
                onSave={handleSaveVariants}
                saveLabel="Save variants"
                hint="SKUs must be unique across the catalogue."
              />
            </AdminSection>

            <AdminSection
              title="Publishing"
              description="Publishing requires a complete product. Drafts can stay incomplete."
            >
              <PublishPanel
                status={product?.status ?? 'draft'}
                blockers={publishBlockers}
                dirty={dirty}
                busy={publishing}
                feedback={publishFeedback}
                onPublish={handlePublish}
                onUnpublish={() =>
                  applyStatus('draft', 'Unpublished. The product is back in draft.')
                }
                onArchive={() => setConfirmArchive(true)}
                onRestore={() => applyStatus('draft', 'Restored to draft.')}
              />
            </AdminSection>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title="Archive product"
        message="The product, its images and its variants are kept, but the product stops appearing on the storefront. You can restore it to draft later."
        confirmLabel="Archive product"
        danger
        busy={publishing}
        onConfirm={() => applyStatus('archived', 'Product archived.')}
        onCancel={() => setConfirmArchive(false)}
      />
    </div>
  );
}

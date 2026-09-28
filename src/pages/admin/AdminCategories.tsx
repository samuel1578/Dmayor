import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { AdminSection } from '../../components/admin/AdminSection';
import {
  countProductsByCategory,
  createCategory,
  listCategories,
  updateCategory,
  type CategoryRecord,
} from '../../lib/admin/products';
import { describeError } from '../../lib/admin/errors';
import { isValidSlug, slugify } from '../../lib/admin/validation';

interface CategoryFormState {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  active: boolean;
}

const emptyForm: CategoryFormState = {
  id: null,
  name: '',
  slug: '',
  description: '',
  active: true,
};

const labelClass =
  'block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-2';

export function AdminCategories() {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ status: 'saved' | 'error'; message: string } | null>(
    null,
  );
  const [form, setForm] = useState<CategoryFormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [categoryList, counts] = await Promise.all([listCategories(), countProductsByCategory()]);
      setCategories(categoryList);
      setProductCounts(counts);
    } catch (err) {
      setLoadError(describeError(err, 'Could not load categories.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startEdit = (category: CategoryRecord) => {
    setForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      active: category.active,
    });
    setSlugTouched(true);
    setFeedback(null);
  };

  const startCreate = () => {
    setForm(emptyForm);
    setSlugTouched(false);
    setFeedback(null);
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
  };

  const handleSlugChange = (slug: string) => {
    setSlugTouched(true);
    setForm((prev) => ({ ...prev, slug }));
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    const slug = (form.slug.trim() || slugify(form.name)).trim();

    if (!name) {
      setFeedback({ status: 'error', message: 'Category name is required.' });
      return;
    }
    if (!isValidSlug(slug)) {
      setFeedback({
        status: 'error',
        message: 'Slug must be lowercase kebab-case (letters, numbers and single hyphens).',
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const input = { name, slug, description: form.description.trim(), active: form.active };

      if (form.id) {
        await updateCategory(form.id, input);
        setFeedback({ status: 'saved', message: `${name} updated.` });
      } else {
        await createCategory(input);
        setFeedback({ status: 'saved', message: `${name} created.` });
      }

      setForm(emptyForm);
      setSlugTouched(false);
      await refresh();
    } catch (err) {
      setFeedback({ status: 'error', message: describeError(err, 'Could not save this category.') });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (category: CategoryRecord) => {
    setBusyId(category.id);
    setFeedback(null);

    try {
      await updateCategory(category.id, {
        name: category.name,
        slug: category.slug,
        description: category.description ?? '',
        active: !category.active,
      });
      setFeedback({
        status: 'saved',
        message: category.active
          ? `${category.name} deactivated — hidden from the storefront.`
          : `${category.name} activated — visible on the storefront.`,
      });
      await refresh();
    } catch (err) {
      setFeedback({ status: 'error', message: describeError(err, 'Could not update this category.') });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-5xl">
      <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-3">Catalogue</p>
      <h1 className="font-display text-4xl sm:text-5xl text-ghana-black dark:text-white">
        Categories
      </h1>
      <p className="mt-3 text-sm text-ghana-black/60 dark:text-white/60 max-w-2xl leading-relaxed">
        Deactivating a category hides it from the storefront. Products keep their category
        assignment, and category deletion is intentionally not offered here.
      </p>

      {loadError && (
        <p role="alert" className="mt-6 text-sm text-ghana-red">
          {loadError}
        </p>
      )}

      {feedback && (
        <p
          role={feedback.status === 'error' ? 'alert' : 'status'}
          className={`mt-6 text-sm ${feedback.status === 'error' ? 'text-ghana-red' : 'text-ghana-green'}`}
        >
          {feedback.message}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div>
          {categories.length === 0 ? (
            <p className="text-sm text-ghana-black/60 dark:text-white/60">
              No categories yet. Create the first one.
            </p>
          ) : (
            <ul className="space-y-4">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-ghana-black dark:text-white font-medium">
                        {category.name}
                      </p>
                      <p className="text-xs text-ghana-black/50 dark:text-white/50">
                        /{category.slug} · {productCounts[category.id] ?? 0} product
                        {(productCounts[category.id] ?? 0) === 1 ? '' : 's'}
                      </p>
                      {category.description && (
                        <p className="mt-2 text-sm text-ghana-black/60 dark:text-white/60">
                          {category.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`text-[10px] uppercase tracking-[0.16em] border rounded-full px-3 py-1 ${
                          category.active
                            ? 'border-ghana-green text-ghana-green'
                            : 'border-ghana-red/60 text-ghana-red'
                        }`}
                      >
                        {category.active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(category)}
                        className="text-xs uppercase tracking-[0.14em] text-ghana-black dark:text-white hover:text-ghana-green"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(category)}
                        disabled={busyId === category.id}
                        className="text-xs uppercase tracking-[0.14em] text-ghana-black/70 dark:text-white/70 hover:text-ghana-green disabled:opacity-50"
                      >
                        {category.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <AdminSection
          title={form.id ? 'Edit category' : 'New category'}
          description={
            form.id
              ? 'Update the details, then save.'
              : 'Slug is generated from the name until you edit it.'
          }
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="category-name" className={labelClass}>
                Name
              </label>
              <input
                id="category-name"
                type="text"
                value={form.name}
                disabled={saving}
                onChange={(e) => handleNameChange(e.target.value)}
                className="input-field"
                placeholder="Shirts"
              />
            </div>

            <div>
              <label htmlFor="category-slug" className={labelClass}>
                Slug
              </label>
              <input
                id="category-slug"
                type="text"
                value={form.slug}
                disabled={saving}
                onChange={(e) => handleSlugChange(e.target.value)}
                onBlur={() => setForm((prev) => ({ ...prev, slug: slugify(prev.slug) }))}
                className="input-field"
                placeholder="shirts"
              />
            </div>

            <div>
              <label htmlFor="category-description" className={labelClass}>
                Description
              </label>
              <textarea
                id="category-description"
                rows={3}
                value={form.description}
                disabled={saving}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="input-field resize-y"
                placeholder="Classic and modern shirts for every occasion"
              />
            </div>

            <label className="flex items-center gap-3 text-sm text-ghana-black dark:text-white cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                disabled={saving}
                onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
                className="h-4 w-4 accent-ghana-green"
              />
              Active (visible on the storefront)
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ghana-black/10 dark:border-white/10 pt-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              aria-busy={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-ghana-green text-white text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 hover:bg-ghana-black disabled:opacity-60"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              {saving ? 'Saving…' : form.id ? 'Save category' : 'Create category'}
            </button>

            {form.id && (
              <button
                type="button"
                onClick={startCreate}
                disabled={saving}
                className="text-xs uppercase tracking-[0.16em] text-ghana-black/60 dark:text-white/60 hover:text-ghana-green disabled:opacity-50"
              >
                Cancel edit
              </button>
            )}
          </div>
        </AdminSection>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { AddressForm } from '../../components/account/AddressForm';
import {
  addressErrorMessage,
  createAddress,
  deleteAddress,
  emptyAddressInput,
  listAddresses,
  setDefaultAddress,
  updateAddress,
  type AddressInput,
  type CustomerAddress,
} from '../../lib/account/addresses';

type Feedback = { status: 'success' | 'error'; message: string } | null;
type Mode = 'idle' | 'add' | 'edit';

/**
 * Saved addresses (Phase D3) — add, edit, delete, set default.
 * Delivery details only; no payment data. Ownership is enforced by RLS —
 * every helper is scoped to the session user id.
 */
export function AccountAddresses() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('idle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const [deleteTarget, setDeleteTarget] = useState<CustomerAddress | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoadError(null);
    try {
      const rows = await listAddresses(userId);
      setAddresses(rows);
    } catch (err) {
      console.error('Address load failed:', err);
      setLoadError('We could not load your addresses.');
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setFeedback(null);
    setFormError(null);
    setEditingId(null);
    setMode('add');
  };

  const openEdit = (address: CustomerAddress) => {
    setFeedback(null);
    setFormError(null);
    setEditingId(address.id);
    setMode('edit');
  };

  const closeForm = () => {
    setMode('idle');
    setEditingId(null);
    setFormError(null);
  };

  const handleSubmit = async (input: AddressInput) => {
    if (!userId || saving) return;

    setSaving(true);
    setFormError(null);
    try {
      if (mode === 'edit' && editingId) {
        await updateAddress(userId, editingId, input);
        setFeedback({ status: 'success', message: 'Address updated.' });
      } else {
        await createAddress(userId, input);
        setFeedback({ status: 'success', message: 'Address saved.' });
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(addressErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (address: CustomerAddress) => {
    if (!userId) return;
    try {
      await setDefaultAddress(userId, address.id);
      setFeedback({ status: 'success', message: 'Default address updated.' });
      await load();
    } catch (err) {
      setFeedback({ status: 'error', message: addressErrorMessage(err) });
    }
  };

  const handleDelete = async () => {
    if (!userId || !deleteTarget) return;

    setDeleting(true);
    try {
      await deleteAddress(userId, deleteTarget.id);
      setDeleteTarget(null);
      setFeedback({ status: 'success', message: 'Address removed.' });
      await load();
    } catch (err) {
      setDeleteTarget(null);
      setFeedback({ status: 'error', message: addressErrorMessage(err) });
    } finally {
      setDeleting(false);
    }
  };

  const editingAddress = addresses?.find((address) => address.id === editingId) ?? null;

  const initialInput: AddressInput =
    mode === 'edit' && editingAddress
      ? {
          label: editingAddress.label ?? '',
          recipientName: editingAddress.recipientName,
          phone: editingAddress.phone,
          addressLine1: editingAddress.addressLine1,
          addressLine2: editingAddress.addressLine2 ?? '',
          city: editingAddress.city,
          region: editingAddress.region ?? '',
          country: editingAddress.country,
          postalCode: editingAddress.postalCode ?? '',
          isDefault: editingAddress.isDefault,
        }
      : { ...emptyAddressInput(), isDefault: (addresses?.length ?? 0) === 0 };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ghana-black sm:text-5xl dark:text-white">
            Addresses
          </h1>
          <p className="mt-3 text-sm text-ghana-black/60 dark:text-white/60">
            Saved delivery details you can reuse when you check out.
          </p>
        </div>

        {mode === 'idle' && (
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black"
          >
            <Plus size={16} aria-hidden="true" />
            Add address
          </button>
        )}
      </div>

      {feedback && (
        <p
          role={feedback.status === 'error' ? 'alert' : 'status'}
          className={`mt-6 text-sm ${
            feedback.status === 'error' ? 'text-ghana-red' : 'text-ghana-green'
          }`}
        >
          {feedback.message}
        </p>
      )}

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-ghana-black/10 p-5 text-sm text-ghana-black/70 dark:border-white/10 dark:text-white/70"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            Try again
          </button>
        </div>
      )}

      {mode !== 'idle' && (
        <div className="mt-8">
          <AddressForm
            key={mode === 'add' ? 'add' : `edit-${editingId}`}
            title={mode === 'add' ? 'New address' : 'Edit address'}
            initial={initialInput}
            isCurrentDefault={mode === 'edit' && (editingAddress?.isDefault ?? false)}
            submitting={saving}
            serverError={formError}
            onSubmit={(input) => void handleSubmit(input)}
            onCancel={closeForm}
          />
        </div>
      )}

      {addresses === null && !loadError && (
        <p className="mt-8 text-sm text-ghana-black/50 dark:text-white/50">Loading addresses…</p>
      )}

      {addresses?.length === 0 && mode === 'idle' && !loadError && (
        <div className="mt-8 rounded-lg border border-dashed border-ghana-black/15 p-8 text-center dark:border-white/15">
          <h2 className="font-display text-2xl text-ghana-black dark:text-white">
            No saved addresses yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ghana-black/60 dark:text-white/60">
            Add an address once and keep it on file for future deliveries.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ghana-green px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black"
          >
            <Plus size={16} aria-hidden="true" />
            Add address
          </button>
        </div>
      )}

      {addresses && addresses.length > 0 && (
        <ul className="mt-8 space-y-4">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="rounded-lg border border-ghana-black/10 p-5 dark:border-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-display text-xl text-ghana-black dark:text-white">
                    {address.label || address.recipientName}
                  </span>
                  {address.isDefault && (
                    <span className="rounded border border-ghana-green/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-ghana-green">
                      Default
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm text-ghana-black/70 dark:text-white/70">
                <p className="text-ghana-black dark:text-white">{address.recipientName}</p>
                <p>{address.phone}</p>
                <p>
                  {address.addressLine1}
                  {address.addressLine2 ? `, ${address.addressLine2}` : ''}
                </p>
                <p>
                  {address.city}
                  {address.region ? `, ${address.region}` : ''} · {address.country}
                  {address.postalCode ? ` · ${address.postalCode}` : ''}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-ghana-black/5 pt-4 dark:border-white/5">
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={() => void handleSetDefault(address)}
                    className="text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
                  >
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(address)}
                  className="text-xs uppercase tracking-[0.16em] text-ghana-black/60 hover:text-ghana-green dark:text-white/60"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    setDeleteTarget(address);
                  }}
                  className="text-xs uppercase tracking-[0.16em] text-ghana-black/60 hover:text-ghana-red dark:text-white/60"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove this address?"
        message={`“${
          deleteTarget?.label || deleteTarget?.recipientName || 'This address'
        }” will be permanently removed. This cannot be undone.`}
        confirmLabel="Remove"
        danger
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </motion.div>
  );
}

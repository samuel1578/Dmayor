import { useState, type FormEvent } from 'react';
import { validateAddress, type AddressInput } from '../../lib/account/addresses';

/**
 * Inline add/edit address form (Phase D3).
 *
 * Mount it with a `key` per editing session (e.g. `add` / `edit-<id>`) so the
 * local state always seeds from `initial`. Practical validation only —
 * required: recipient, phone, address line 1, city, country. Postal code stays
 * optional (Ghana). No external address verification.
 */

interface AddressFormProps {
  title: string;
  initial: AddressInput;
  /** The row being edited is already the default → toggle locked on. */
  isCurrentDefault?: boolean;
  submitting: boolean;
  serverError?: string | null;
  onSubmit: (input: AddressInput) => void;
  onCancel: () => void;
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  full?: boolean;
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  disabled,
  required,
  full,
}: FieldProps) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <label
        htmlFor={id}
        className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50"
      >
        {label}
        {!required && <span className="ml-1 normal-case tracking-normal">(optional)</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

export function AddressForm({
  title,
  initial,
  isCurrentDefault = false,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: AddressFormProps) {
  const [form, setForm] = useState<AddressInput>(initial);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof AddressInput) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const validation = validateAddress(form);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    onSubmit(form);
  };

  const feedback = error ?? serverError;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10"
      noValidate
    >
      <h2 className="font-display text-2xl text-ghana-black dark:text-white">{title}</h2>

      {feedback && (
        <p role="alert" className="mt-4 text-sm text-ghana-red">
          {feedback}
        </p>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field
          id="address-label"
          label="Label"
          value={form.label}
          onChange={set('label')}
          placeholder="Home, Work…"
          disabled={submitting}
        />
        <Field
          id="address-recipient"
          label="Recipient name"
          value={form.recipientName}
          onChange={set('recipientName')}
          autoComplete="name"
          placeholder="Who receives this delivery"
          disabled={submitting}
          required
        />
        <Field
          id="address-phone"
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={set('phone')}
          autoComplete="tel"
          placeholder="+233 20 000 0000"
          disabled={submitting}
          required
        />
        <Field
          id="address-country"
          label="Country"
          value={form.country}
          onChange={set('country')}
          autoComplete="country-name"
          disabled={submitting}
          required
        />
        <Field
          id="address-line1"
          label="Address line 1"
          value={form.addressLine1}
          onChange={set('addressLine1')}
          autoComplete="address-line1"
          placeholder="Street, area"
          disabled={submitting}
          required
          full
        />
        <Field
          id="address-line2"
          label="Address line 2"
          value={form.addressLine2}
          onChange={set('addressLine2')}
          autoComplete="address-line2"
          placeholder="Landmark, building"
          disabled={submitting}
          full
        />
        <Field
          id="address-city"
          label="City"
          value={form.city}
          onChange={set('city')}
          autoComplete="address-level2"
          disabled={submitting}
          required
        />
        <Field
          id="address-region"
          label="Region"
          value={form.region}
          onChange={set('region')}
          autoComplete="address-level1"
          disabled={submitting}
        />
        <Field
          id="address-postal"
          label="Postal code"
          value={form.postalCode}
          onChange={set('postalCode')}
          autoComplete="postal-code"
          disabled={submitting}
        />
      </div>

      <div className="mt-6 flex items-start gap-3">
        <input
          id="address-default"
          type="checkbox"
          checked={form.isDefault}
          disabled={submitting || isCurrentDefault}
          onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
          className="mt-0.5 h-4 w-4 accent-ghana-green"
        />
        <label htmlFor="address-default" className="text-sm text-ghana-black dark:text-white">
          Set as default address
          {isCurrentDefault && (
            <span className="mt-0.5 block text-xs text-ghana-black/50 dark:text-white/50">
              This is already your default address.
            </span>
          )}
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ghana-black/10 pt-6 dark:border-white/10">
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="rounded-lg bg-ghana-green px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save address'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="text-xs uppercase tracking-[0.16em] text-ghana-black/60 hover:text-ghana-green disabled:opacity-50 dark:text-white/60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

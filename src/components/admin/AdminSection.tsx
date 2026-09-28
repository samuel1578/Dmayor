import type { ReactNode } from 'react';

export type SectionSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AdminSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}

export function AdminSection({ title, description, children, id }: AdminSectionProps) {
  return (
    <section
      id={id}
      className="border border-ghana-black/10 dark:border-white/10 rounded-lg p-5 sm:p-6 bg-white/60 dark:bg-white/[0.03]"
    >
      <h2 className="font-display text-2xl text-ghana-black dark:text-white">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-ghana-black/60 dark:text-white/60 leading-relaxed">
          {description}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

interface SectionSaveBarProps {
  status: SectionSaveStatus;
  message?: string | null;
  hint?: string | null;
  onSave: () => void;
  saveLabel?: string;
  disabled?: boolean;
}

export function SectionSaveBar({
  status,
  message,
  hint,
  onSave,
  saveLabel = 'Save changes',
  disabled = false,
}: SectionSaveBarProps) {
  const saving = status === 'saving';

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ghana-black/10 dark:border-white/10 pt-4">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        aria-busy={saving}
        className="px-5 py-2.5 rounded-lg bg-ghana-green text-white text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 hover:bg-ghana-black disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving…' : saveLabel}
      </button>

      {status === 'error' && message ? (
        <span role="alert" className="text-sm text-ghana-red">
          {message}
        </span>
      ) : status === 'saved' && message ? (
        <span role="status" className="text-sm text-ghana-green">
          {message}
        </span>
      ) : hint ? (
        <span className="text-xs text-ghana-black/50 dark:text-white/50">{hint}</span>
      ) : null}
    </div>
  );
}

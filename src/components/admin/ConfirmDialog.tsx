import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  /** Optional form content rendered between the message and the actions. */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Focus the confirm button when it can take focus. When it cannot (busy,
    // or blocked until a required field is filled) the browser silently
    // ignores focus() on a disabled control, which would drop keyboard focus
    // onto <body> — so the panel takes focus instead and keeps the user
    // inside the dialog.
    const confirm = confirmRef.current;
    if (confirm && !confirm.disabled) {
      confirm.focus();
    } else {
      panelRef.current?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, busy, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-ghana-black/55"
            onClick={onCancel}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-md bg-ghana-light dark:bg-ghana-dark border border-ghana-black/10 dark:border-white/15 rounded-lg p-6"
          >
            <h3 className="font-display text-2xl text-ghana-black dark:text-white">{title}</h3>
            <p className="mt-3 text-sm text-ghana-black/70 dark:text-white/70 leading-relaxed">
              {message}
            </p>

            {children}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 rounded-lg border border-ghana-black/15 dark:border-white/20 text-xs uppercase tracking-[0.16em] text-ghana-black dark:text-white transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green"
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={onConfirm}
                disabled={busy}
                aria-busy={busy}
                className={`px-5 py-2.5 rounded-lg text-white text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
                  danger ? 'bg-ghana-red hover:bg-ghana-black' : 'bg-ghana-green hover:bg-ghana-black'
                }`}
              >
                {busy ? 'Working…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

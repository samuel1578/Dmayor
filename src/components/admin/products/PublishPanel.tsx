import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { ProductStatus } from '../../../lib/admin/products';
import { statusLabels } from '../../../lib/admin/format';

export interface PublishFeedback {
  status: 'idle' | 'saved' | 'error';
  message: string | null;
}

interface PublishPanelProps {
  status: ProductStatus;
  blockers: string[];
  dirty: boolean;
  busy: boolean;
  feedback: PublishFeedback;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
}

const statusStyles: Record<ProductStatus, string> = {
  draft: 'border-ghana-black/20 dark:border-white/25 text-ghana-black/70 dark:text-white/70',
  active: 'border-ghana-green text-ghana-green',
  archived: 'border-ghana-red/60 text-ghana-red',
};

export function PublishPanel({
  status,
  blockers,
  dirty,
  busy,
  feedback,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
}: PublishPanelProps) {
  const ready = blockers.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
          Current status
        </span>
        <span
          className={`text-[10px] uppercase tracking-[0.2em] border rounded-full px-3 py-1 ${statusStyles[status]}`}
        >
          {statusLabels[status] ?? status}
        </span>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ghana-black dark:text-white">
          {ready ? 'Ready to publish' : 'Publishing requirements'}
        </h3>
        <ul className="mt-3 space-y-2">
          {ready ? (
            <li className="flex items-start gap-2 text-sm text-ghana-green">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              All checks passed.
            </li>
          ) : (
            blockers.map((blocker) => (
              <li
                key={blocker}
                className="flex items-start gap-2 text-sm text-ghana-black/70 dark:text-white/70"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-ghana-red" aria-hidden="true" />
                {blocker}
              </li>
            ))
          )}
        </ul>
      </div>

      {dirty && (
        <p className="text-xs text-ghana-black/60 dark:text-white/60">
          You have unsaved changes. Save the general, image and variant sections before changing the
          publish status.
        </p>
      )}

      {feedback.message && (
        <p
          role={feedback.status === 'error' ? 'alert' : 'status'}
          className={`text-sm ${feedback.status === 'error' ? 'text-ghana-red' : 'text-ghana-green'}`}
        >
          {feedback.message}
        </p>
      )}

      <div className="flex flex-wrap gap-3 border-t border-ghana-black/10 dark:border-white/10 pt-4">
        {status !== 'active' && (
          <button
            type="button"
            onClick={onPublish}
            disabled={busy || !ready || dirty}
            aria-busy={busy}
            className="px-5 py-2.5 rounded-lg bg-ghana-green text-white text-xs font-semibold uppercase tracking-[0.16em] transition-colors duration-200 hover:bg-ghana-black disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? 'Working…' : 'Publish'}
          </button>
        )}

        {status === 'active' && (
          <button
            type="button"
            onClick={onUnpublish}
            disabled={busy || dirty}
            className="px-5 py-2.5 rounded-lg border border-ghana-black/20 dark:border-white/25 text-xs uppercase tracking-[0.16em] text-ghana-black dark:text-white transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Unpublish (back to draft)
          </button>
        )}

        {status === 'archived' ? (
          <button
            type="button"
            onClick={onRestore}
            disabled={busy}
            className="px-5 py-2.5 rounded-lg border border-ghana-black/20 dark:border-white/25 text-xs uppercase tracking-[0.16em] text-ghana-black dark:text-white transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green disabled:opacity-60"
          >
            Restore to draft
          </button>
        ) : (
          <button
            type="button"
            onClick={onArchive}
            disabled={busy || dirty}
            className="px-5 py-2.5 rounded-lg border border-ghana-red/50 text-xs uppercase tracking-[0.16em] text-ghana-red transition-colors duration-200 hover:bg-ghana-red hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Archive
          </button>
        )}
      </div>
    </div>
  );
}

const cediFormatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Ghana cedi display for the Admin UI. */
export function formatCedis(value: number | string): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return '—';
  return cediFormatter.format(numeric);
}

export function formatAdminDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Date + time for operational timestamps (order paid/confirmed/shipped/…),
 * where "when exactly" matters more than the date alone.
 */
export function formatAdminDateTime(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const statusLabels: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

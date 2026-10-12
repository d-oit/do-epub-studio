import { getCurrentLocale } from '../stores/locale';

/**
 * Format a byte count into a human-readable string (e.g. "1.5 MB").
 *
 * Magitudes are binary (1024-based) and the unit ladder is unchanged; only the
 * *number* is localized, through the active UI locale rather than the browser
 * default — a user who selects German must not see "1.5 MB" where German writes
 * "1,5 MB" (A10/GOAP-307). Call sites re-render on locale change (they read
 * `useTranslation()`), so the next call picks the new locale up.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const magnitude = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const unit = units[magnitude] ?? 'B';
  const value = bytes / Math.pow(1024, magnitude);
  // Bytes are whole; larger magnitudes keep one decimal, as before.
  const fractionDigits = magnitude === 0 ? 0 : 1;
  const formatted = new Intl.NumberFormat(getCurrentLocale(), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
  return `${formatted} ${unit}`;
}

import type { TranslationKeys } from '../../../../i18n';

type TranslateFn = (key: TranslationKeys, params?: Record<string, string | number>) => string;

export function formatDate(dateString: string, t?: TranslateFn): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t ? t('relativeTime.justNow') : 'just now';
  if (diffMins < 60) return t ? t('relativeTime.minutesAgo', { count: diffMins }) : `${diffMins}m ago`;
  if (diffHours < 24) return t ? t('relativeTime.hoursAgo', { count: diffHours }) : `${diffHours}h ago`;
  if (diffDays < 7) return t ? t('relativeTime.daysAgo', { count: diffDays }) : `${diffDays}d ago`;

  return date.toLocaleDateString();
}

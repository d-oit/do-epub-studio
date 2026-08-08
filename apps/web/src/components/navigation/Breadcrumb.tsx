import { Link } from 'react-router-dom';
import type { TranslationKeys } from '../../i18n';
import { useTranslation } from '../../hooks/useTranslation';

interface BreadcrumbItem {
  labelKey: TranslationKeys;
  /** Omit href for the current (last) item. */
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * Semantic breadcrumb navigation for admin pages.
 *
 * Uses `<nav aria-label="Breadcrumb">` with `<ol>/<li>` per WCAG best
 * practices. The last item is rendered as the current page (no link).
 *
 * @param items - Ordered list of breadcrumb entries
 *
 * @example
 * ```tsx
 * <Breadcrumb items={[
 *   { labelKey: 'admin.breadcrumb.home', href: '/admin' },
 *   { labelKey: 'admin.breadcrumb.books' },
 * ]} />
 * ```
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  const { t } = useTranslation();

  return (
    // eslint-disable-next-line i18next/no-literal-string -- aria-label is a semantic landmark attribute
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-sm text-foreground-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.labelKey} className="flex items-center gap-1.5">
              {index > 0 && (
                <svg
                  className="w-3.5 h-3.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {isLast || !item.href ? (
                <span className="font-medium text-foreground" aria-current={isLast ? 'page' : undefined}>
                  {t(item.labelKey)}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm transition-colors"
                >
                  {t(item.labelKey)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

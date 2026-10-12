import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../../components/ui';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Breadcrumb } from '../../components/navigation';

/** Admin route paths (constants avoid i18next/no-literal-string in JSX). */
const ADMIN_ROUTES = { admin: '/admin', books: '/admin/books' } as const;
/** Destinations the header itself navigates to. */
const HEADER_ROUTES = { audit: '/admin/audit', login: '/login' } as const;

interface BooksPageHeaderProps {
  onCreateClick: () => void;
}

/** Title bar of the admin books page, extracted from BooksPage (ADR-278). */
export function BooksPageHeader({ onCreateClick }: BooksPageHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <Breadcrumb
        items={[
          { labelKey: 'admin.breadcrumb.home', href: ADMIN_ROUTES.admin },
          { labelKey: 'admin.breadcrumb.books' },
        ]}
      />
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-rule)] pb-6">
        <div>
          <h1 className="text-balance-tight font-display text-3xl leading-tight text-foreground md:text-4xl">
            {t('admin.books.title')}
          </h1>
          <button
            onClick={() => {
              void navigate(HEADER_ROUTES.login);
            }}
            className="touch-target mt-1 inline-flex items-center px-2 py-0.5 text-sm text-accent hover:opacity-80"
          >
            &larr; {t('admin.books.backToReader')}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={onCreateClick}>{t('admin.createBook')}</Button>
          <button
            onClick={() => {
              void navigate(HEADER_ROUTES.audit);
            }}
            className="px-4 py-2 bg-background border border-border rounded-md text-sm font-medium text-foreground-muted hover:bg-background-secondary"
          >
            {t('admin.books.viewAuditLogs')}
          </button>
          <LocaleSwitcher />
        </div>
      </header>
    </>
  );
}

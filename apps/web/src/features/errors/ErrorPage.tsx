import { Link } from 'react-router-dom';
import { PageContainer, Button } from '@do-epub-studio/ui';
import { useTranslation } from '../../hooks/useTranslation';

export function ErrorPage() {
  const { t } = useTranslation();

  return (
    <PageContainer className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <main id="main-content" className="max-w-md w-full text-center py-16">
        <div
          className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6"
          aria-hidden="true"
        >
          <svg
            className="w-10 h-10 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          {t('common.error.generic')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {t('errors.generic_description' as any)}
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => window.location.reload()}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium"
          >
            {t('common.retry')}
          </Button>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-gray-600 dark:text-gray-400 font-medium hover:underline"
          >
            {t('errors.boundary.home' as any)}
          </Link>
        </div>
      </main>
    </PageContainer>
  );
}

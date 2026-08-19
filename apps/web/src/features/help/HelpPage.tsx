import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo, Button } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';
import { DEMO_READER_EMAIL, DEMO_READER_PASSWORD, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_BOOK_SLUG } from '../../config/demo-config';

export function HelpPage() {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="fixed right-3 top-3 z-20 flex items-center gap-2 sm:right-4 sm:top-4">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>

      <main
        id="main-content"
        className="mx-auto w-full max-w-2xl pt-16 pb-8"
      >
        <div className="flex flex-col items-center text-center">
          <AppLogo size={64} className="mb-4 text-accent" />
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.12em] text-foreground-muted">
            {APP_NAME} · {t('app.versionLabel')} {APP_VERSION_LABEL}
          </p>
          <h1 className="text-balance font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            {t('help.title')}
          </h1>
        </div>

        <section className="mt-8 space-y-6">
          <div className="rounded-lg border border-border bg-background-secondary p-5 shadow-md sm:p-7">
            <p className="text-base leading-relaxed text-foreground">
              {t('help.intro', { app: APP_NAME })}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background-secondary p-5 shadow-md sm:p-7">
            <h2 className="text-lg font-semibold text-foreground">
              {t('help.demoTitle')}
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              {t('help.demoBody')}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              <li className="rounded-md bg-background p-3 font-medium">
                {t('help.demoReader', { email: DEMO_READER_EMAIL, password: DEMO_READER_PASSWORD, slug: DEMO_BOOK_SLUG })}
              </li>
              <li className="rounded-md bg-background p-3 font-medium">
                {t('help.demoAdmin', { email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD })}
              </li>
            </ul>
          </div>
        </section>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link to="/login" /* eslint-disable-line i18next/no-literal-string -- route path */>
            <Button variant="secondary">{t('help.backToLogin')}</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

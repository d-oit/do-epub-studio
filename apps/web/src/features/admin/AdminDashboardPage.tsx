import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Spinner } from '@do-epub-studio/ui';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { formatBytes } from '../../lib/formatBytes';
import type { TranslationKeys } from '../../i18n';

interface AdminStats {
  totalBooks: number;
  archivedBooks: number;
  activeGrants: number;
  activeSessions: number;
  storageBytes: number;
  recentActivity: { action: string; count: number }[];
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-background-secondary rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground-muted">{label}</span>
        <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

const ICONS = {
  books: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
  grants: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  sessions: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  storage: 'M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2zm0 0V5a2 2 0 012-2h12a2 2 0 012 2v2',
};

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiRequest<AdminStats>('/api/admin/stats', { token: sessionToken ?? undefined });
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [sessionToken]);

  // biome-ignore lint/correctness/useQwikValidLexicalScope: React app, not Qwik
  const handleBooksNav = () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate() returns void, not Promise (react-router-dom v7)
    navigate('/admin/books');
  };
  // biome-ignore lint/correctness/useQwikValidLexicalScope: React app, not Qwik
  const handleGrantsNav = () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate() returns void, not Promise (react-router-dom v7)
    navigate('/admin/grants');
  };
  // biome-ignore lint/correctness/useQwikValidLexicalScope: React app, not Qwik
  const handleAuditNav = () => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate() returns void, not Promise (react-router-dom v7)
    navigate('/admin/audit');
  };

  return (
    <main id="main-content" className="min-h-dvh bg-background p-4 sm:p-6 lg:p-8">
      <header className="flex justify-between flex-wrap gap-4 items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('admin.dashboardTitle')}</h1>
          <div className="flex gap-3 mt-2 text-sm">
            <button type="button" onClick={handleBooksNav} className="text-accent hover:opacity-80">
              {t('admin.books.title')} &rarr;
            </button>
            <button type="button" onClick={handleGrantsNav} className="text-accent hover:opacity-80">
              {t('admin.grants.title')} &rarr;
            </button>
            <button type="button" onClick={handleAuditNav} className="text-accent hover:opacity-80">
              {t('admin.audit.title')} &rarr;
            </button>
          </div>
        </div>
        <LocaleSwitcher />
      </header>

      {error && (
        <div role="alert" className="mb-6 p-4 bg-semantic-error/10 border border-semantic-error/30 rounded-lg text-semantic-error">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label={t('admin.stats.totalBooks')} value={stats.totalBooks} icon={ICONS.books} />
            <StatCard label={t('admin.stats.activeGrants')} value={stats.activeGrants} icon={ICONS.grants} />
            <StatCard label={t('admin.stats.activeSessions')} value={stats.activeSessions} icon={ICONS.sessions} />
            <StatCard label={t('admin.stats.storageUsed')} value={formatBytes(stats.storageBytes)} icon={ICONS.storage} />
          </div>

          {stats.recentActivity.length > 0 && (
            <section className="bg-background-secondary rounded-xl border border-border p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">{t('admin.stats.recentActivity')}</h2>
              <ul className="space-y-2">
                {stats.recentActivity.map((item) => {
                  const actionKey = `admin.stats.action.${item.action}` as TranslationKeys;
                  const unknownKey = 'admin.stats.action.unknown' as TranslationKeys;
                  const label = t(actionKey) === actionKey ? t(unknownKey) : t(actionKey);
                  return (
                    <li key={item.action} className="flex justify-between text-sm">
                      <span className="text-foreground-muted">{label}</span>
                      <span className="font-medium text-foreground">{item.count}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      ) : null}
    </main>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Spinner } from '@do-epub-studio/ui';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { formatBytes } from '../../lib/formatBytes';
import { formatDate } from '../../lib/i18n-format';
import type { TranslationKeys } from '../../i18n';

interface AdminStats {
  totalBooks: number;
  archivedBooks: number;
  activeGrants: number;
  activeSessions: number;
  storageBytes: number;
  recentActivity: { action: string; count: number }[];
}

interface BookInsightAggregate {
  bookId: string;
  totalActiveMinutes: number;
  totalActivePages: number;
  readerCount: number;
  lastActivity: string | null;
}

const INSIGHTS_PAGE_SIZE = 20;

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-sm border border-border bg-surface p-6 shadow-page">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground-muted">{label}</span>
        <svg
          className="w-5 h-5 text-accent"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
      </div>
      <p className="font-display text-3xl text-foreground">{value}</p>
    </div>
  );
}

const ICONS = {
  books: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
  grants:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  sessions:
    'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  storage:
    'M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2zm0 0V5a2 2 0 012-2h12a2 2 0 012 2v2',
};

import { Breadcrumb } from '../../components/navigation';

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightRows, setInsightRows] = useState<BookInsightAggregate[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsOffset, setInsightsOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiRequest<AdminStats>('/api/admin/stats', {
          token: sessionToken ?? undefined,
        });
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadInsights() {
      setInsightsLoading(true);
      setInsightsError(null);
      try {
        const data = await apiRequest<BookInsightAggregate[]>(
          `/api/admin/insights?limit=${INSIGHTS_PAGE_SIZE}&offset=${insightsOffset}`,
          { token: sessionToken ?? undefined },
        );
        if (!cancelled) setInsightRows(data);
      } catch (err) {
        if (!cancelled) {
          setInsightsError(err instanceof Error ? err.message : 'Failed to load insights');
        }
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    }
    void loadInsights();
    return () => {
      cancelled = true;
    };
  }, [sessionToken, insightsOffset]);

  // biome-ignore lint/correctness/useQwikValidLexicalScope: React app, not Qwik
  const handleBooksNav = () => {
    void navigate('/admin/books');
  };
  // biome-ignore lint/correctness/useQwikValidLexicalScope: React app, not Qwik
  const handleGrantsNav = () => {
    void navigate('/admin/grants');
  };
  // biome-ignore lint/correctness/useQwikValidLexicalScope: React app, not Qwik
  const handleAuditNav = () => {
    void navigate('/admin/audit');
  };
  // biome-ignore lint/correctness/useQwikValidLexicalScope: React app, not Qwik
  const handleAccountNav = () => {
    void navigate('/admin/account');
  };

  return (
    <main id="main-content" className="min-h-dvh bg-background p-4 sm:p-6 lg:p-8">
      <Breadcrumb items={[{ labelKey: 'admin.breadcrumb.home' }]} />
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-rule)] pb-6">
        <div>
          <h1 className="text-balance-tight font-display text-3xl leading-tight text-foreground md:text-4xl">
            {t('admin.dashboardTitle')}
          </h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              onClick={handleBooksNav}
              className="touch-target inline-flex items-center text-accent hover:opacity-80"
            >
              {t('admin.books.title')} &rarr;
            </button>
            <button
              type="button"
              onClick={handleGrantsNav}
              className="touch-target inline-flex items-center text-accent hover:opacity-80"
            >
              {t('admin.grants.title')} &rarr;
            </button>
            <button
              type="button"
              onClick={handleAuditNav}
              className="touch-target inline-flex items-center text-accent hover:opacity-80"
            >
              {t('admin.audit.title')} &rarr;
            </button>
            <button
              type="button"
              onClick={handleAccountNav}
              className="touch-target inline-flex items-center text-accent hover:opacity-80"
            >
              {t('admin.account.title')} &rarr;
            </button>
          </div>
        </div>
        <LocaleSwitcher />
      </header>

      {error && (
        <div
          role="alert"
          className="mb-6 p-4 bg-semantic-error/10 border border-semantic-error/30 rounded-sm text-semantic-error"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label={t('admin.stats.totalBooks')}
              value={stats.totalBooks}
              icon={ICONS.books}
            />
            <StatCard
              label={t('admin.stats.activeGrants')}
              value={stats.activeGrants}
              icon={ICONS.grants}
            />
            <StatCard
              label={t('admin.stats.activeSessions')}
              value={stats.activeSessions}
              icon={ICONS.sessions}
            />
            <StatCard
              label={t('admin.stats.storageUsed')}
              value={formatBytes(stats.storageBytes)}
              icon={ICONS.storage}
            />
          </div>

          {stats.recentActivity.length > 0 && (
            <section className="rounded-sm border border-border bg-surface p-6 shadow-page">
              <h2 className="mb-4 font-display text-lg leading-snug text-foreground">
                {t('admin.stats.recentActivity')}
              </h2>
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

          {/* N2: Book-only aggregate reading insights — never individual identity/timelines */}
          <section className="mt-8 rounded-sm border border-border bg-surface p-6 shadow-page">
            <h2 className="mb-4 font-display text-lg leading-snug text-foreground">
              {t('admin.insights.title')}
            </h2>
            {insightsLoading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : insightsError ? (
              <p className="text-sm text-semantic-error">{t('admin.insights.loadFailed')}</p>
            ) : insightRows.length === 0 ? (
              <p className="text-sm text-foreground-muted">{t('admin.insights.empty')}</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-foreground-muted">
                        <th scope="col" className="py-2 pr-4 font-medium">
                          {t('admin.insights.book')}
                        </th>
                        <th scope="col" className="py-2 pr-4 font-medium">
                          {t('admin.insights.activeTime')}
                        </th>
                        <th scope="col" className="py-2 pr-4 font-medium">
                          {t('admin.insights.pages')}
                        </th>
                        <th scope="col" className="py-2 pr-4 font-medium">
                          {t('admin.insights.readers')}
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          {t('admin.insights.lastActivity')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {insightRows.map((row) => (
                        <tr key={row.bookId} className="border-b border-border/50">
                          <td className="py-2 pr-4 font-mono text-xs">{row.bookId}</td>
                          <td className="py-2 pr-4">{formatMinutes(row.totalActiveMinutes)}</td>
                          <td className="py-2 pr-4">{row.totalActivePages}</td>
                          <td className="py-2 pr-4">{row.readerCount}</td>
                          <td className="py-2">
                            {row.lastActivity ? formatDate(new Date(row.lastActivity)) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={insightsOffset === 0}
                    onClick={() =>
                      setInsightsOffset(Math.max(0, insightsOffset - INSIGHTS_PAGE_SIZE))
                    }
                    className="text-sm text-accent disabled:opacity-40"
                  >
                    {t('admin.insights.previous')}
                  </button>
                  <button
                    type="button"
                    disabled={insightRows.length < INSIGHTS_PAGE_SIZE}
                    onClick={() => setInsightsOffset(insightsOffset + INSIGHTS_PAGE_SIZE)}
                    className="text-sm text-accent disabled:opacity-40"
                  >
                    {t('admin.insights.next')}
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

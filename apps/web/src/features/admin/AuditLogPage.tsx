import { Component, Suspense, use, useState, useCallback, useRef, type ErrorInfo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import type { TranslationKeys } from '../../i18n';
import {
  fetchAuditLogs,
  invalidateAuditLogCache,
  type AuditLogFilters,
} from '../../lib/data-cache';
import { useAuthStore } from '../../stores/auth';
import type { AuditLogResponse } from '@do-epub-studio/shared';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { Spinner } from '@do-epub-studio/ui';

const PAGE_SIZE = 50;
const ENTITY_TYPE_OPTIONS: Array<{ value: string; labelKey: TranslationKeys }> = [
  { value: '', labelKey: 'admin.audit.entityType.all' },
  { value: 'book', labelKey: 'admin.audit.entityType.book' },
  { value: 'grant', labelKey: 'admin.audit.entityType.grant' },
  { value: 'session', labelKey: 'admin.audit.entityType.session' },
  { value: 'comment', labelKey: 'admin.audit.entityType.comment' },
  { value: 'user', labelKey: 'admin.audit.entityType.user' },
  { value: 'highlight', labelKey: 'admin.audit.entityType.highlight' },
  { value: 'bookmark', labelKey: 'admin.audit.entityType.bookmark' },
];

interface AuditTableProps {
  data: { entries: AuditLogResponse[]; total: number };
  page: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

function AuditTable({ data, page, total, onPrev, onNext }: AuditTableProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const renderPaginationInfo = () => {
    if (total === 0) return t('admin.audit.paginationInfoZero');
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min((page - 1) * PAGE_SIZE + data.entries.length, total);
    return t('admin.audit.paginationInfo').replace('{start}', String(start)).replace('{end}', String(end)).replace('{total}', String(total));
  };

  if (data.entries.length === 0) {
    return (
      <section tabIndex={0} className="bg-background-secondary shadow-sm rounded-lg border border-border overflow-x-auto" aria-label={t('admin.audit.tableLabel')}>
        <p className="px-6 py-12 text-center text-foreground-muted">
          {t('admin.audit.noLogs')}
        </p>
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <span className="text-sm text-foreground-muted">{renderPaginationInfo()}</span>
        </div>
      </section>
    );
  }

  return (
    <section tabIndex={0} className="bg-background-secondary shadow-sm rounded-lg border border-border overflow-x-auto" aria-label={t('admin.audit.tableLabel')}>
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-background-secondary">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
              {t('admin.audit.timestamp')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
              {t('admin.audit.actor')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
              {t('admin.audit.action')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground-muted uppercase tracking-wider">
              {t('admin.audit.entity')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.entries.map((log) => (
            <tr key={log.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground-muted">
                {new Date(log.createdAt).toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                {log.actorEmail || t('admin.audit.systemActor')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground-muted">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-semantic-info/20 text-semantic-info">
                  {log.action}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground-muted">
                {log.entityType}: {log.entityId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-6 py-4 border-t border-border">
        <span className="text-sm text-foreground-muted">
          {renderPaginationInfo()}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={page <= 1}
            className="px-3 py-1 text-sm border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed bg-background text-foreground-muted hover:bg-background-secondary"
          >
            {t('admin.audit.previous')}
          </button>
          <span className="text-sm text-foreground-muted">
            {t('admin.audit.pageOf').replace('{page}', String(page)).replace('{total}', String(totalPages))}
          </span>
          <button
            onClick={onNext}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed bg-background text-foreground-muted hover:bg-background-secondary"
          >
            {t('admin.audit.next')}
          </button>
        </div>
      </div>
    </section>
  );
}

interface AuditBodyProps extends AuditLogFilters {
  token: string;
  onPrev: () => void;
  onNext: () => void;
}

function AuditBody({ token, onPrev, onNext, ...filters }: AuditBodyProps) {
  const data = use(fetchAuditLogs({ ...filters, pageSize: PAGE_SIZE }, token));
  return (
    <AuditTable
      data={data}
      page={filters.page}
      total={data.total}
      onPrev={onPrev}
      onNext={onNext}
    />
  );
}

function AuditSkeleton() {
  return (
    <div
      className="bg-background-secondary shadow-sm rounded-lg border border-border p-12 flex justify-center"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner />
    </div>
  );
}

interface AuditErrorBoundaryProps {
  children: ReactNode;
}

interface AuditErrorBoundaryState {
  error: Error | null;
}

class AuditErrorBoundary extends Component<AuditErrorBoundaryProps, AuditErrorBoundaryState> {
  public state: AuditErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): AuditErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Surface to global error handler in a real app; keep quiet in tests.
  }

  public render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="mb-6 p-4 bg-semantic-error/10 border border-semantic-error/30 rounded-lg text-semantic-error"
        >
          {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

export function AdminAuditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sessionToken = useAuthStore((state) => state.sessionToken);

  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtersRef = useRef({ page, entityType, entityId, dateFrom, dateTo });
  filtersRef.current = { page, entityType, entityId, dateFrom, dateTo };

  const handleBack = useCallback(() => {
    void navigate('/admin/books');
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    invalidateAuditLogCache();
    // Re-fetch by toggling a state to trigger re-render
    setPage((p) => p);
  }, []);

  const handleResetFilters = useCallback(() => {
    setEntityType('');
    setEntityId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  const handlePreviousPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const handleExportCSV = useCallback(() => {
    const f = filtersRef.current;
    void fetchAuditLogs(
      { ...f, pageSize: PAGE_SIZE },
      sessionToken,
    ).then((d) => {
      const header = 'ID,Timestamp,Actor Email,Entity Type,Entity ID,Action,Payload\n';
      const rows = d.entries.map((log) => {
        const payload = log.payload ? `"${JSON.stringify(log.payload).replace(/"/g, '""')}"` : '';
        return `"${log.id}","${new Date(log.createdAt).toISOString()}","${(log.actorEmail || '').replace(/"/g, '""')}","${log.entityType.replace(/"/g, '""')}","${log.entityId.replace(/"/g, '""')}","${log.action.replace(/"/g, '""')}",${payload}`;
      });
      const csv = header + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(() => undefined);
  }, [sessionToken]);

  return (
    <main id="main-content" className="min-h-dvh bg-background p-4 sm:p-6 lg:p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('admin.audit.title')}
          </h1>
          <button
            onClick={handleBack}
            className="text-sm text-accent hover:opacity-80 mt-1"
          >
            &larr; {t('admin.audit.backToBooks')}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-background border border-border rounded-md text-sm font-medium text-foreground-muted hover:bg-background-secondary"
          >
            {t('admin.audit.exportCsv')}
          </button>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-background border border-border rounded-md text-sm font-medium text-foreground-muted hover:bg-background-secondary"
          >
            {t('admin.audit.refresh')}
          </button>
          <LocaleSwitcher />
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            {t('admin.audit.entityType')}
          </label>
          <select
            aria-label={t('admin.audit.entityType')}
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
          >
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            {t('admin.audit.entityId')}
          </label>
          <input
            type="text"
            value={entityId}
            onChange={(e) => { setEntityId(e.target.value); setPage(1); }}
            placeholder={t('admin.audit.filterByEntityId')}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-foreground-muted"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            {t('admin.audit.dateFrom')}
          </label>
          <input
            type="date"
            aria-label={t('admin.audit.dateFrom')}
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            {t('admin.audit.dateTo')}
          </label>
          <input
            type="date"
            aria-label={t('admin.audit.dateTo')}
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
          />
        </div>
        <button
          onClick={handleResetFilters}
          className="px-4 py-2 bg-background border border-border rounded-md text-sm font-medium text-foreground-muted hover:bg-background-secondary"
        >
          {t('admin.audit.resetFilters')}
        </button>
      </div>

      <Suspense fallback={<AuditSkeleton />}>
        <AuditErrorBoundary>
          <AuditBody
            token={sessionToken ?? ''}
            page={page}
            pageSize={PAGE_SIZE}
            entityType={entityType}
            entityId={entityId}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onPrev={handlePreviousPage}
            onNext={handleNextPage}
          />
        </AuditErrorBoundary>
      </Suspense>
    </main>
  );
}

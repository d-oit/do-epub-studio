import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import type { AuditLogResponse } from '@do-epub-studio/shared';
import { LocaleSwitcher } from '../../components/LocaleSwitcher';

interface AuditLogPageResponse {
  entries: AuditLogResponse[];
  total: number;
}

const PAGE_SIZE = 50;
const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'book', label: 'Book' },
  { value: 'grant', label: 'Grant' },
  { value: 'session', label: 'Session' },
  { value: 'comment', label: 'Comment' },
  { value: 'user', label: 'User' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'bookmark', label: 'Bookmark' },
];

export function AdminAuditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchAuditLogs = useCallback(async (
    currentPage: number,
    filters: { entityType: string; entityId: string; dateFrom: string; dateTo: string },
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String((currentPage - 1) * PAGE_SIZE));
      if (filters.entityType) params.set('entityType', filters.entityType);
      if (filters.entityId) params.set('entityId', filters.entityId);
      if (filters.dateFrom) params.set('from', filters.dateFrom);
      if (filters.dateTo) params.set('to', filters.dateTo);

      const data = await apiRequest<AuditLogPageResponse>(`/api/admin/audit-logs?${params.toString()}`, { token: sessionToken ?? undefined });
      setLogs(data.entries);
      setTotal(data.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    void fetchAuditLogs(page, { entityType, entityId, dateFrom, dateTo });
  }, [page, entityType, entityId, dateFrom, dateTo, fetchAuditLogs]);

  const handleBack = () => {
    void navigate('/admin/books');
  };

  const handleRefresh = () => {
    void fetchAuditLogs(page, { entityType, entityId, dateFrom, dateTo });
  };

  const handleResetFilters = () => {
    setEntityType('');
    setEntityId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handlePreviousPage = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setPage((p) => Math.min(totalPages, p + 1));
  };

  const handleExportCSV = () => {
    const header = 'ID,Timestamp,Actor Email,Entity Type,Entity ID,Action,Payload\n';
    const rows = logs.map((log) => {
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
  };

  const renderPaginationInfo = () => {
    if (total === 0) return '0 entries';
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min((page - 1) * PAGE_SIZE + logs.length, total);
    return `${start}-${end} of ${total} entries`;
  };

  return (
    <main id="main-content" className="min-h-screen bg-background p-8">
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
            Export CSV
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

      {error && (
        <div className="mb-6 p-4 bg-semantic-error/10 border border-semantic-error/30 rounded-lg text-semantic-error">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            Entity Type
          </label>
          <select
            aria-label="Entity Type"
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
          >
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            Entity ID
          </label>
          <input
            type="text"
            value={entityId}
            onChange={(e) => { setEntityId(e.target.value); setPage(1); }}
            placeholder="Filter by entity ID"
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-foreground-muted"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            Date From
          </label>
          <input
            type="date"
            aria-label="Date From"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1">
            Date To
          </label>
          <input
            type="date"
            aria-label="Date To"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground"
          />
        </div>
        <button
          onClick={handleResetFilters}
          className="px-4 py-2 bg-background border border-border rounded-md text-sm font-medium text-foreground-muted hover:bg-background-secondary"
        >
          Reset Filters
        </button>
      </div>

      <div className="bg-background-secondary shadow-sm rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : (
          <>
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
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground-muted">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {log.actorEmail || 'System'}
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
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-foreground-muted">
                      {t('admin.audit.noLogs')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <span className="text-sm text-foreground-muted">
                {renderPaginationInfo()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed bg-background text-foreground-muted hover:bg-background-secondary"
                >
                  Previous
                </button>
                <span className="text-sm text-foreground-muted">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed bg-background text-foreground-muted hover:bg-background-secondary"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

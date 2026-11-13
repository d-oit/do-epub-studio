import { useCallback, useEffect, useRef, useState, useId } from 'react';
import type { BookResponse } from '@do-epub-studio/shared';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAuthStore } from '../../../stores/auth';
import { Button, useFocusTrap } from '@do-epub-studio/ui';
import { FindingsGroupList } from './FindingsGroupList';
import { ValidationAccessibilitySection } from './ValidationAccessibilitySection';
import {
  ValidationRemediationSection,
  type RemediationStatus,
} from './ValidationRemediationSection';
import {
  fetchRevisionReports,
  fetchRevisionValidationDetail,
  type RevisionReportSummary,
  type RevisionValidationDetail,
  type AccessibilityRemediationState,
} from '../../../lib/api/admin-validation';

export interface RevisionValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: BookResponse | null;
  onRetryWithStepUp: (bookId: string, revisionId: string) => Promise<void>;
  onSaveRemediationWithStepUp: (
    bookId: string,
    revisionId: string,
    remediation: AccessibilityRemediationState,
  ) => Promise<void>;
}

type TabKey = 'findings' | 'accessibility' | 'remediation';

const TABS: readonly TabKey[] = ['findings', 'accessibility', 'remediation'];

export function RevisionValidationModal({
  isOpen,
  onClose,
  book,
  onRetryWithStepUp,
  onSaveRemediationWithStepUp,
}: RevisionValidationModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(isOpen, containerRef);

  const [reports, setReports] = useState<RevisionReportSummary[]>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RevisionValidationDetail | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('findings');

  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSavingRemediation, setIsSavingRemediation] = useState(false);
  const [remediationFeedback, setRemediationFeedback] = useState<string | null>(null);

  const [remediationStatus, setRemediationStatus] = useState<RemediationStatus>('not_started');
  const [remediationNotes, setRemediationNotes] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const pollCountRef = useRef(0);

  const loadReports = useCallback(async () => {
    if (!book) return;
    setIsLoadingReports(true);
    setError(null);
    try {
      const data = await fetchRevisionReports(book.id, sessionToken ?? undefined);
      setReports(data);
      if (data.length > 0) {
        const first = data[0];
        setSelectedRevisionId((prev) =>
          prev && data.some((r) => r.revisionId === prev) ? prev : first ? first.revisionId : null,
        );
      } else {
        setSelectedRevisionId(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoadingReports(false);
    }
  }, [book, sessionToken]);

  const loadDetail = useCallback(
    async (revisionId: string) => {
      if (!book) return;
      setIsLoadingDetail(true);
      setError(null);
      try {
        const data = await fetchRevisionValidationDetail(
          book.id,
          revisionId,
          sessionToken ?? undefined,
        );
        setDetail(data);
        if (data.remediation) {
          setRemediationStatus(data.remediation.status ?? 'not_started');
          setRemediationNotes(data.remediation.notes ?? '');
          setChecklist(data.remediation.checklist ?? {});
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [book, sessionToken],
  );

  useEffect(() => {
    if (isOpen && book) {
      void loadReports();
    } else {
      setReports([]);
      setDetail(null);
      setSelectedRevisionId(null);
      setError(null);
      setActiveTab('findings');
      pollCountRef.current = 0;
    }
  }, [isOpen, book, loadReports]);

  useEffect(() => {
    if (selectedRevisionId) {
      void loadDetail(selectedRevisionId);
    } else {
      setDetail(null);
    }
  }, [selectedRevisionId, loadDetail]);

  useEffect(() => {
    if (!isOpen || !selectedRevisionId || detail?.status !== 'pending') return;
    if (pollCountRef.current >= 10) return;

    const timer = setTimeout(() => {
      pollCountRef.current += 1;
      void loadDetail(selectedRevisionId);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isOpen, selectedRevisionId, detail?.status, loadDetail]);

  const handleDownload = () => {
    if (!book || !selectedRevisionId) return;
    const url = `/api/admin/books/${encodeURIComponent(book.id)}/revisions/${encodeURIComponent(selectedRevisionId)}/validation.json`;
    const token = sessionToken;
    void fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `validation-report-${selectedRevisionId}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch((err) => setError((err as Error).message));
  };

  const handleRetry = async () => {
    if (!book || !selectedRevisionId) return;
    setIsRetrying(true);
    setError(null);
    try {
      await onRetryWithStepUp(book.id, selectedRevisionId);
      pollCountRef.current = 0;
      await loadDetail(selectedRevisionId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSaveRemediation = async () => {
    if (!book || !selectedRevisionId) return;
    setIsSavingRemediation(true);
    setError(null);
    setRemediationFeedback(null);
    try {
      await onSaveRemediationWithStepUp(book.id, selectedRevisionId, {
        status: remediationStatus,
        notes: remediationNotes.trim() ? remediationNotes.trim() : null,
        checklist,
      });
      setRemediationFeedback(t('admin.validation.remediationSuccess'));
      setTimeout(() => setRemediationFeedback(null), 4000);
      await loadDetail(selectedRevisionId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSavingRemediation(false);
    }
  };

  if (!isOpen) return null;

  const currentSummary = reports.find((r) => r.revisionId === selectedRevisionId);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-md border border-border bg-surface text-foreground shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-secondary/50">
          <div>
            <h2 id={titleId} className="font-display text-lg font-semibold text-foreground">
              {t('admin.validation.title')}
            </h2>
            <p className="text-xs text-foreground-muted">{book?.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded p-1 text-foreground-muted hover:text-foreground text-xs"
          >
            {t('common.close')}
          </button>
        </div>

        {error && (
          <div className="m-4 p-3 rounded bg-semantic-error/10 border border-semantic-error/30 text-xs text-semantic-error">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-background-tertiary/60 p-3 rounded border border-border">
            <div className="flex items-center gap-2">
              <label
                htmlFor="revision-select"
                className="text-xs font-medium text-foreground-muted"
              >
                {t('admin.validation.revisions')}:
              </label>
              {isLoadingReports ? (
                <span className="text-xs text-foreground-muted">
                  {t('admin.validation.loading')}
                </span>
              ) : reports.length === 0 ? (
                <span className="text-xs text-foreground-muted">
                  {t('admin.validation.noRevisions')}
                </span>
              ) : (
                <select
                  id="revision-select"
                  value={selectedRevisionId ?? ''}
                  onChange={(e) => setSelectedRevisionId(e.target.value)}
                  className="text-xs rounded border border-border bg-surface px-2 py-1 text-foreground"
                >
                  {reports.map((r) => {
                    const label = `${r.revisionId.slice(0, 8)} (${new Date(r.updatedAt).toLocaleDateString()}) [${r.status}]`;
                    return (
                      <option key={r.revisionId} value={r.revisionId}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => selectedRevisionId && void loadDetail(selectedRevisionId)}
              >
                {t('admin.validation.refresh')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                disabled={!detail}
              >
                {t('admin.validation.downloadReport')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleRetry()}
                disabled={isRetrying || !detail}
              >
                {isRetrying
                  ? t('admin.validation.retrying')
                  : t('admin.validation.retryValidation')}
              </Button>
            </div>
          </div>

          {currentSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-border rounded p-3 bg-surface">
              <div>
                <span className="text-foreground-muted">
                  {t('admin.validation.status.status')}:
                </span>{' '}
                <span className="font-semibold uppercase">
                  {detail?.safetyStatus === 'rejected'
                    ? t('admin.validation.status.rejected')
                    : (detail?.status ?? currentSummary.status)}
                </span>
              </div>
              <div>
                <span className="text-foreground-muted">{t('admin.validation.epubVersion')}:</span>{' '}
                <span className="font-semibold">
                  {detail?.epubVersion ??
                    currentSummary.epubVersion ??
                    t('admin.validation.unknown')}
                </span>
              </div>
              <div>
                <span className="text-foreground-muted">
                  {t('admin.validation.validatorVersion')}:
                </span>{' '}
                <span className="font-semibold">
                  {detail?.validatorVersion ?? currentSummary.validatorVersion}
                </span>
              </div>
              <div>
                <span className="text-foreground-muted">{t('admin.validation.uploadedAt')}:</span>{' '}
                <span>
                  {new Date(detail?.updatedAt ?? currentSummary.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="flex border-b border-border space-x-2" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-accent text-accent'
                    : 'border-transparent text-foreground-muted hover:text-foreground'
                }`}
              >
                {tab === 'findings'
                  ? `${t('admin.validation.findingsTab')} (${(detail?.groups.errors.length ?? 0) + (detail?.groups.warnings.length ?? 0)})`
                  : tab === 'accessibility'
                    ? t('admin.validation.accessibilityTab')
                    : t('admin.validation.remediationTab')}
              </button>
            ))}
          </div>

          {isLoadingDetail ? (
            <div className="py-8 text-center text-xs text-foreground-muted">
              {t('admin.validation.loading')}
            </div>
          ) : !detail ? (
            <div className="py-8 text-center text-xs text-foreground-muted">
              {t('admin.validation.noFindings')}
            </div>
          ) : activeTab === 'findings' ? (
            <div className="space-y-4">
              <FindingsGroupList
                title={t('admin.validation.errors')}
                items={detail.groups.errors}
                variant="error"
              />
              <FindingsGroupList
                title={t('admin.validation.warnings')}
                items={detail.groups.warnings}
                variant="warning"
              />
              <FindingsGroupList
                title={t('admin.validation.info')}
                items={detail.groups.information}
                variant="info"
              />
            </div>
          ) : activeTab === 'accessibility' ? (
            <ValidationAccessibilitySection accessibility={detail.accessibility} />
          ) : (
            <ValidationRemediationSection
              status={remediationStatus}
              setStatus={setRemediationStatus}
              notes={remediationNotes}
              setNotes={setRemediationNotes}
              checklist={checklist}
              setChecklist={setChecklist}
              onSave={handleSaveRemediation}
              isSaving={isSavingRemediation}
              feedback={remediationFeedback}
            />
          )}
        </div>

        <div className="flex justify-end p-3 border-t border-border bg-surface-secondary/40">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('annotation.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}

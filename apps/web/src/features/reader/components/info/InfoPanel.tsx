import { useEffect, useRef, useState, useCallback } from 'react';
import { useKeyboardShortcut } from '../../../../hooks/useKeyboardShortcut';
import { IconButton } from '../../../../components/ui';
import { useFocusTrap } from '@do-epub-studio/ui';
import type { AccessibilityMetadata } from '@do-epub-studio/reader-core';
import { computeInsightSummary } from '../../../../lib/offline/reading-insights';
import { apiRequest } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { AccessibilitySection } from './AccessibilitySection';
import { InsightsSection, type SyncedInsights } from './InsightsSection';

/**
 * Boundary guard for `GET /api/books/:id/insights`. The panel renders on every
 * reader page, so a malformed or partial payload must degrade to the
 * "unavailable" state rather than crash the render. Dependency-free on purpose:
 * this module is in the reader route chunk, which cannot afford the `zod`
 * runtime (ADR-107 §3).
 */
function isSyncedInsights(value: unknown): value is SyncedInsights {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.totalActiveMinutes !== 'number' ||
    typeof v.totalActivePages !== 'number' ||
    typeof v.currentStreakDays !== 'number' ||
    !Array.isArray(v.recentActivity)
  ) {
    return false;
  }
  return v.recentActivity.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const a = entry as Record<string, unknown>;
    return (
      typeof a.date === 'string' &&
      typeof a.activeMinutes === 'number' &&
      typeof a.activePages === 'number'
    );
  });
}

interface BookInfo {
  title: string;
  creator?: string;
  publisher?: string;
  language?: string;
  description?: string;
  accessibility?: AccessibilityMetadata;
}

interface InsightSummary {
  totalActiveMinutes: number;
  totalActivePages: number;
  estimatedMinutesRemaining: number | null;
  currentStreakDays: number;
  recentActivity: { date: string; activeMinutes: number; activePages: number }[];
  chapterDurations: { href: string; activeMinutes: number }[];
  readingSpeedWpm: number | null;
}

interface InfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: BookInfo | null;
  bookId: string | null;
  progressPercent: number;
  t: (key: string) => string;
}

export function InfoPanel({
  isOpen,
  onClose,
  metadata,
  bookId,
  progressPercent,
  t,
}: InfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [insights, setInsights] = useState<InsightSummary | null>(null);
  const [syncedInsights, setSyncedInsights] = useState<SyncedInsights | null>(null);
  const [syncedLoading, setSyncedLoading] = useState(false);
  const [syncedError, setSyncedError] = useState<string | null>(null);

  useKeyboardShortcut('Escape', onClose, { enabled: isOpen });
  useFocusTrap(isOpen, panelRef);

  useEffect(() => {
    if (!isOpen || !bookId) return;
    let cancelled = false;
    computeInsightSummary(bookId, progressPercent)
      .then((summary) => {
        if (!cancelled) setInsights(summary);
      })
      .catch(() => {
        if (!cancelled) setInsights(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, bookId, progressPercent]);

  useEffect(() => {
    if (!isOpen || !bookId || !sessionToken) {
      setSyncedInsights(null);
      return;
    }
    let cancelled = false;
    setSyncedLoading(true);
    setSyncedError(null);
    void apiRequest<unknown>(`/api/books/${bookId}/insights`, { token: sessionToken })
      .then((data) => {
        if (cancelled) return;
        if (isSyncedInsights(data)) {
          setSyncedInsights(data);
        } else {
          setSyncedInsights(null);
          setSyncedError('Unexpected insights payload');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSyncedError(err instanceof Error ? err.message : 'Unavailable');
        }
      })
      .finally(() => {
        if (!cancelled) setSyncedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, bookId, sessionToken]);

  const handleExportInsights = useCallback(() => {
    if (!insights || !bookId) return;
    const exportData = {
      bookId,
      exportedAt: new Date().toISOString(),
      insights: {
        totalActiveMinutes: insights.totalActiveMinutes,
        totalActivePages: insights.totalActivePages,
        estimatedMinutesRemaining: insights.estimatedMinutesRemaining,
        currentStreakDays: insights.currentStreakDays,
        recentActivity: insights.recentActivity,
        chapterDurations: insights.chapterDurations,
        readingSpeedWpm: insights.readingSpeedWpm,
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `book-${bookId}-insights.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [insights, bookId]);

  if (!isOpen) return null;

  const a11y = metadata?.accessibility;
  const hasA11y = a11y && (a11y.summary || a11y.features.length > 0 || a11y.hazards.length > 0);
  const hasLocalInsights =
    insights && (insights.totalActiveMinutes > 0 || insights.totalActivePages > 0);

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-panel-title"
      className="fixed inset-y-0 right-0 w-80 bg-background border-l border-border z-40 flex flex-col shadow-xl"
    >
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h2 id="info-panel-title" className="font-semibold text-foreground">
          {t('reader.aboutBook')}
        </h2>
        <IconButton onClick={onClose} variant="ghost" aria-label={t('a11y.close')}>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {!metadata ? (
          <p className="text-sm text-foreground-muted text-center py-8">
            {t('reader.metadataNotAvailable')}
          </p>
        ) : (
          <>
            <section>
              <h3 className="eyebrow mb-2">{t('reader.details')}</h3>
              <dl className="space-y-2">
                {metadata.title && (
                  <div>
                    <dt className="text-xs text-foreground-muted">{t('reader.title')}</dt>
                    <dd className="text-sm text-foreground">{metadata.title}</dd>
                  </div>
                )}
                {metadata.creator && (
                  <div>
                    <dt className="text-xs text-foreground-muted">{t('reader.author')}</dt>
                    <dd className="text-sm text-foreground">{metadata.creator}</dd>
                  </div>
                )}
                {metadata.publisher && (
                  <div>
                    <dt className="text-xs text-foreground-muted">{t('reader.publisher')}</dt>
                    <dd className="text-sm text-foreground">{metadata.publisher}</dd>
                  </div>
                )}
                {metadata.language && (
                  <div>
                    <dt className="text-xs text-foreground-muted">{t('reader.language')}</dt>
                    <dd className="text-sm text-foreground">{metadata.language}</dd>
                  </div>
                )}
              </dl>
            </section>

            {metadata.description && (
              <section>
                <h3 className="eyebrow mb-2">{t('reader.description')}</h3>
                <p className="text-sm text-foreground leading-relaxed">{metadata.description}</p>
              </section>
            )}

            {hasA11y && <AccessibilitySection a11y={a11y} t={t} />}
          </>
        )}

        {/* Reading insights do not depend on book metadata: they stay available
            (and keep their device-local/synced split) even when the EPUB's
            metadata could not be read. */}
        <div className="pt-2">
          <InsightsSection
            insights={insights}
            syncedInsights={syncedInsights}
            syncedError={syncedError}
            syncedLoading={syncedLoading}
            t={t}
          />

          {/* N3: Offline download of local insight summary as JSON */}
          <div className="mt-4 pt-3 border-t border-border">
            <button
              type="button"
              onClick={handleExportInsights}
              disabled={!hasLocalInsights}
              className="w-full text-xs font-medium py-2 px-3 rounded border border-border hover:bg-background-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-foreground"
            >
              {t('reader.exportInsights')}
            </button>
            <p className="mt-1.5 text-[11px] text-foreground-muted leading-tight">
              {t('reader.exportInsightsNote')}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

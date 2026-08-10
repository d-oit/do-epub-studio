import { useEffect, useRef, useState } from 'react';
import { useKeyboardShortcut } from '../../../../hooks/useKeyboardShortcut';
import { IconButton } from '../../../../components/ui';
import { useFocusTrap } from '@do-epub-studio/ui';
import type { AccessibilityMetadata } from '@do-epub-studio/reader-core';
import { computeInsightSummary } from '../../../../lib/offline/reading-insights';
import { AccessibilitySection } from './AccessibilitySection';
import { InsightsSection } from './InsightsSection';

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
}

interface InfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: BookInfo | null;
  bookId: string | null;
  progressPercent: number;
  t: (key: string) => string;
}

export function InfoPanel({ isOpen, onClose, metadata, bookId, progressPercent, t }: InfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [insights, setInsights] = useState<InsightSummary | null>(null);

  useKeyboardShortcut('Escape', onClose, { enabled: isOpen });
  useFocusTrap(isOpen, panelRef);

  useEffect(() => {
    if (!isOpen || !bookId) return;
    let cancelled = false;
    computeInsightSummary(bookId, progressPercent)
      .then((summary) => { if (!cancelled) setInsights(summary); })
      .catch(() => { if (!cancelled) setInsights(null); });
    return () => { cancelled = true; };
  }, [isOpen, bookId, progressPercent]);

  if (!isOpen) return null;

  const a11y = metadata?.accessibility;
  const hasA11y = a11y && (a11y.summary || a11y.features.length > 0 || a11y.hazards.length > 0);
  const hasInsights = insights && (insights.totalActiveMinutes > 0 || insights.totalActivePages > 0);

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
        <IconButton onClick={onClose} variant="ghost" size="sm" aria-label={t('a11y.close')}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
              <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
                {t('reader.details')}
              </h3>
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
                <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
                  {t('reader.description')}
                </h3>
                <p className="text-sm text-foreground leading-relaxed">{metadata.description}</p>
              </section>
            )}

            {hasA11y && <AccessibilitySection a11y={a11y} t={t} />}
            {hasInsights && <InsightsSection insights={insights} t={t} />}
          </>
        )}
      </div>
    </aside>
  );
}

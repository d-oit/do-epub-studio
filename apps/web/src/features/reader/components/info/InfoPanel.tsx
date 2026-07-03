import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../../../components/ui';
import type { AccessibilityMetadata } from '@do-epub-studio/reader-core';
import { computeInsightSummary } from '../../../../lib/offline/reading-insights';

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

function FeatureBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
      {label}
    </span>
  );
}

function formatHazard(hazard: string): string {
  switch (hazard) {
    case 'none': return 'None';
    case 'flashing': return 'Flashing';
    case 'motionSimulation': return 'Motion Simulation';
    case 'sound': return 'Sound';
    case 'unknown': return 'Unknown';
    default: return hazard;
  }
}

function HazardBadge({ hazard }: { hazard: string }) {
  const isNone = hazard === 'none';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
        isNone
          ? 'bg-success/10 text-success border-success/20'
          : 'bg-warning/10 text-warning border-warning/20'
      }`}
    >
      {formatHazard(hazard)}
    </span>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function InfoPanel({ isOpen, onClose, metadata, bookId, progressPercent, t }: InfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [insights, setInsights] = useState<InsightSummary | null>(null);

  useEffect(() => {
    if (!isOpen || !bookId) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);

    computeInsightSummary(bookId, progressPercent).then(setInsights).catch(() => {
      setInsights(null);
    });

    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, bookId, progressPercent]);

  if (!isOpen) return null;

  const a11y = metadata?.accessibility;
  const hasA11y = a11y && (a11y.summary || a11y.features.length > 0 || a11y.hazards.length > 0);

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
        <IconButton
          onClick={onClose}
          variant="ghost"
          size="sm"
          aria-label={t('reader.settings.close')}
        >
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

            {hasA11y && (
              <section>
                <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
                  {t('reader.accessibility')}
                </h3>
                <div className="space-y-3">
                  {a11y.summary && (
                    <p className="text-sm text-foreground leading-relaxed">{a11y.summary}</p>
                  )}

                  {a11y.conformsTo && (
                    <div>
                      <span className="text-xs text-foreground-muted">{t('reader.conformsTo')}: </span>
                      <span className="text-xs text-foreground font-medium">{a11y.conformsTo}</span>
                    </div>
                  )}

                  {a11y.features.length > 0 && (
                    <div>
                      <p className="text-xs text-foreground-muted mb-1.5">{t('reader.features')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {a11y.features.map((f) => (
                          <FeatureBadge key={f} label={f} />
                        ))}
                      </div>
                    </div>
                  )}

                  {a11y.hazards.length > 0 && (
                    <div>
                      <p className="text-xs text-foreground-muted mb-1.5">{t('reader.hazards')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {a11y.hazards.map((h) => (
                          <HazardBadge key={h} hazard={h} />
                        ))}
                      </div>
                    </div>
                  )}

                  {a11y.controls.length > 0 && (
                    <div>
                      <p className="text-xs text-foreground-muted mb-1.5">{t('reader.controls')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {a11y.controls.map((c) => (
                          <FeatureBadge key={c} label={c} />
                        ))}
                      </div>
                    </div>
                  )}

                  {a11y.api && (
                    <div className="text-xs">
                      <span className="text-foreground-muted">{t('reader.api')}: </span>
                      <span className="text-foreground font-medium">{a11y.api}</span>
                    </div>
                  )}

                  {a11y.certifiedBy && (
                    <div className="text-xs">
                      <span className="text-foreground-muted">{t('reader.certifiedBy')}: </span>
                      <span className="text-foreground font-medium">{a11y.certifiedBy}</span>
                      {a11y.certifierCredential && (
                        <span className="text-foreground-muted"> ({a11y.certifierCredential})</span>
                      )}
                    </div>
                  )}

                  {a11y.certifierReport && (
                    <div className="text-xs">
                      <a
                        href={a11y.certifierReport}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        {t('reader.certificationReport')}
                      </a>
                    </div>
                  )}
                </div>
              </section>
            )}

            {insights && (insights.totalActiveMinutes > 0 || insights.totalActivePages > 0) && (
              <section>
                <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
                  {t('reader.readingInsights')}
                </h3>
                <dl className="space-y-2">
                  {insights.totalActiveMinutes > 0 && (
                    <div>
                      <dt className="text-xs text-foreground-muted">{t('reader.totalActiveTime')}</dt>
                      <dd className="text-sm text-foreground">
                        {formatMinutes(insights.totalActiveMinutes)}
                      </dd>
                    </div>
                  )}
                  {insights.totalActivePages > 0 && (
                    <div>
                      <dt className="text-xs text-foreground-muted">{t('reader.pagesRead')}</dt>
                      <dd className="text-sm text-foreground">
                        {insights.totalActivePages}
                      </dd>
                    </div>
                  )}
                  {insights.estimatedMinutesRemaining !== null && (
                    <div>
                      <dt className="text-xs text-foreground-muted">{t('reader.estimatedRemaining')}</dt>
                      <dd className="text-sm text-foreground">
                        {formatMinutes(insights.estimatedMinutesRemaining)}
                      </dd>
                    </div>
                  )}
                  {insights.currentStreakDays > 0 && (
                    <div>
                      <dt className="text-xs text-foreground-muted">{t('reader.readingStreak')}</dt>
                      <dd className="text-sm text-foreground">
                        {insights.currentStreakDays} {t('reader.days')}
                      </dd>
                    </div>
                  )}
                  {insights.recentActivity.length > 0 && (
                    <div>
                      <dt className="text-xs text-foreground-muted">{t('reader.recentActivity')}</dt>
                      <dd className="text-foreground text-xs leading-tight">
                        <ul className="space-y-1 mt-1">
                          {[...insights.recentActivity].reverse().map((a) => (
                            <li key={a.date} className="flex justify-between">
                              <span>{a.date}</span>
                              <span className="text-foreground-muted">
                                {formatMinutes(a.activeMinutes)} • {a.activePages}p
                              </span>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

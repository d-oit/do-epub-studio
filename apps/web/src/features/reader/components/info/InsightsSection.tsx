type TFn = (key: string, params?: Record<string, string | number>) => string;

export interface InsightSummary {
  totalActiveMinutes: number;
  totalActivePages: number;
  estimatedMinutesRemaining: number | null;
  currentStreakDays: number;
  recentActivity: { date: string; activeMinutes: number; activePages: number }[];
  chapterDurations: { href: string; activeMinutes: number }[];
  readingSpeedWpm: number | null;
}

export interface SyncedInsights {
  totalActiveMinutes: number;
  totalActivePages: number;
  currentStreakDays: number;
  recentActivity: { date: string; activeMinutes: number; activePages: number }[];
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function InsightsSection({
  insights,
  syncedInsights,
  syncedError,
  syncedLoading,
  t,
}: {
  insights: InsightSummary | null;
  syncedInsights?: SyncedInsights | null;
  syncedError?: string | null;
  syncedLoading?: boolean;
  t: TFn;
}) {
  const hasLocal =
    insights &&
    (insights.totalActiveMinutes > 0 ||
      insights.totalActivePages > 0 ||
      insights.estimatedMinutesRemaining !== null ||
      insights.currentStreakDays > 0);

  const hasSynced =
    syncedInsights &&
    (syncedInsights.totalActiveMinutes > 0 ||
      syncedInsights.totalActivePages > 0 ||
      syncedInsights.currentStreakDays > 0 ||
      syncedInsights.recentActivity.length > 0);

  return (
    <div className="space-y-4">
      {/* Device-local Insights Section */}
      <section>
        <h3 className="eyebrow mb-2">
          {t('reader.readingInsights')} ({t('reader.deviceLocal')})
        </h3>
        {hasLocal && insights ? (
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
                <dd className="text-sm text-foreground">{insights.totalActivePages}</dd>
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
            {insights.chapterDurations.length > 0 && (
              <div>
                <dt className="text-xs text-foreground-muted">{t('reader.chapterTime')}</dt>
                <dd className="text-sm text-foreground">
                  {t('reader.chapterTimeValue', {
                    minutes: insights.chapterDurations[0]?.activeMinutes ?? 0,
                  })}
                </dd>
              </div>
            )}
            {insights.readingSpeedWpm !== null && (
              <div>
                <dt className="text-xs text-foreground-muted">{t('reader.readingSpeed')}</dt>
                <dd className="text-sm text-foreground">
                  {t('reader.readingSpeedValue', { wpm: insights.readingSpeedWpm })}
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
                          {formatMinutes(a.activeMinutes)} · {a.activePages}
                          {t('reader.pages_abbr')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-xs text-foreground-muted">{t('reader.noLocalActivity')}</p>
        )}
      </section>

      {/* Synced Reading History Section (Separately labelled, NEVER summed with local) */}
      <section className="pt-3 border-t border-border">
        <h3 className="eyebrow mb-2">{t('reader.syncedHistory')}</h3>
        {syncedLoading ? (
          <p className="text-xs text-foreground-muted">{t('reader.loadingSynced')}</p>
        ) : syncedError ? (
          <p className="text-xs text-foreground-muted italic">{t('reader.syncedUnavailable')}</p>
        ) : hasSynced && syncedInsights ? (
          <dl className="space-y-2">
            <div>
              <dt className="text-xs text-foreground-muted">{t('reader.syncedActiveTime')}</dt>
              <dd className="text-sm text-foreground font-medium">
                {formatMinutes(syncedInsights.totalActiveMinutes)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground-muted">{t('reader.syncedPagesRead')}</dt>
              <dd className="text-sm text-foreground font-medium">
                {syncedInsights.totalActivePages}
              </dd>
            </div>
            {syncedInsights.currentStreakDays > 0 && (
              <div>
                <dt className="text-xs text-foreground-muted">{t('reader.readingStreak')}</dt>
                <dd className="text-sm text-foreground">
                  {syncedInsights.currentStreakDays} {t('reader.days')}
                </dd>
              </div>
            )}
            {syncedInsights.recentActivity.length > 0 && (
              <div>
                <dt className="text-xs text-foreground-muted">{t('reader.recentActivity')}</dt>
                <dd className="text-foreground text-xs leading-tight">
                  <ul className="space-y-1 mt-1">
                    {syncedInsights.recentActivity.slice(0, 7).map((a) => (
                      <li key={a.date} className="flex justify-between">
                        <span>{a.date}</span>
                        <span className="text-foreground-muted">
                          {formatMinutes(a.activeMinutes)} · {a.activePages}
                          {t('reader.pages_abbr')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-xs text-foreground-muted">{t('reader.noSyncedHistory')}</p>
        )}
      </section>
    </div>
  );
}

type TFn = (key: string) => string;

interface InsightSummary {
  totalActiveMinutes: number;
  totalActivePages: number;
  estimatedMinutesRemaining: number | null;
  currentStreakDays: number;
  recentActivity: { date: string; activeMinutes: number; activePages: number }[];
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function InsightsSection({ insights, t }: { insights: InsightSummary; t: TFn }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
        {t('reader.readingInsights')}
      </h3>
      <dl className="space-y-2">
        {insights.totalActiveMinutes > 0 && (
          <div>
            <dt className="text-xs text-foreground-muted">{t('reader.totalActiveTime')}</dt>
            <dd className="text-sm text-foreground">{formatMinutes(insights.totalActiveMinutes)}</dd>
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
            <dd className="text-sm text-foreground">{formatMinutes(insights.estimatedMinutesRemaining)}</dd>
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
                    {/* eslint-disable-next-line i18next/no-literal-string -- unit suffix and separator */}
                    <span className="text-foreground-muted">{formatMinutes(a.activeMinutes)} • {a.activePages}p</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

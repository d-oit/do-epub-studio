import type { AccessibilityMetadata } from '@do-epub-studio/reader-core';

type TFn = (key: string) => string;

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

export function AccessibilitySection({ a11y, t }: { a11y: AccessibilityMetadata; t: TFn }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
        {t('reader.accessibility')}
      </h3>
      <div className="space-y-3">
        {a11y.summary && (
          <p className="text-sm text-foreground leading-relaxed">{a11y.summary}</p>
        )}
        <dl className="space-y-2">
          {a11y.conformsTo && (
            <div>
              <dt className="text-xs text-foreground-muted">{t('reader.conformsTo')}</dt>
              <dd className="text-xs text-foreground font-medium">{a11y.conformsTo}</dd>
            </div>
          )}
          {a11y.api && (
            <div>
              <dt className="text-xs text-foreground-muted">{t('reader.api')}</dt>
              <dd className="text-xs text-foreground font-medium">{a11y.api}</dd>
            </div>
          )}
          {a11y.certifiedBy && (
            <div>
              <dt className="text-xs text-foreground-muted">{t('reader.certifiedBy')}</dt>
              <dd className="text-xs text-foreground font-medium">
                {a11y.certifiedBy}
                {a11y.certifierCredential && (
                  <span className="text-foreground-muted"> ({a11y.certifierCredential})</span>
                )}
              </dd>
            </div>
          )}
        </dl>
        {a11y.features.length > 0 && (
          <div>
            <p className="text-xs text-foreground-muted mb-1.5">{t('reader.features')}</p>
            <div className="flex flex-wrap gap-1.5">
              {a11y.features.map((f) => <FeatureBadge key={f} label={f} />)}
            </div>
          </div>
        )}
        {a11y.hazards.length > 0 && (
          <div>
            <p className="text-xs text-foreground-muted mb-1.5">{t('reader.hazards')}</p>
            <div className="flex flex-wrap gap-1.5">
              {a11y.hazards.map((h) => <HazardBadge key={h} hazard={h} />)}
            </div>
          </div>
        )}
        {a11y.controls.length > 0 && (
          <div>
            <p className="text-xs text-foreground-muted mb-1.5">{t('reader.controls')}</p>
            <div className="flex flex-wrap gap-1.5">
              {a11y.controls.map((c) => <FeatureBadge key={c} label={c} />)}
            </div>
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
  );
}

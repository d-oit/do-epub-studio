import { useTranslation } from '../../../hooks/useTranslation';
import type { AccessibilityEvidence, AccessibilityProfile } from '../../../lib/api/admin-validation';

function ProfileSpecBadge({ profile }: { profile: AccessibilityProfile }) {
  const { t } = useTranslation();
  if (!profile.spec) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-background-tertiary text-foreground-muted">
        {t('admin.validation.specUnavailable')}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
        profile.experimental
          ? 'bg-semantic-warning/10 text-semantic-warning border-semantic-warning/20'
          : 'bg-accent/10 text-accent border-accent/20'
      }`}
    >
      {profile.spec.version} · {profile.spec.status}
      {profile.experimental ? ` · ${t('admin.validation.experimental')}` : ''}
    </span>
  );
}

function ProfileFindings({ profile }: { profile: AccessibilityProfile }) {
  const { t } = useTranslation();
  if (profile.findings.length === 0) {
    return <p className="text-foreground-muted">{t('admin.validation.noProfileFindings')}</p>;
  }
  return (
    <ul className="space-y-2">
      {profile.findings.map((finding, i) => (
        <li
          key={i}
          className="p-2 rounded border border-border bg-surface flex justify-between gap-2"
        >
          <span className="text-foreground">
            <span className="font-mono text-accent">{finding.code}</span> {finding.message}
          </span>
          <span className="uppercase text-[10px] text-foreground-muted">{finding.severity}</span>
        </li>
      ))}
    </ul>
  );
}

function ProfileEvidence({ profile }: { profile: AccessibilityProfile }) {
  const { t } = useTranslation();
  if (profile.evidence.length === 0) {
    return <p className="text-foreground-muted">{t('admin.validation.noEvidence')}</p>;
  }
  return (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-background-tertiary border-b border-border text-foreground-muted">
          <tr>
            <th className="p-2">{t('admin.validation.clause')}</th>
            <th className="p-2">{t('admin.validation.check')}</th>
            <th className="p-2">{t('admin.validation.result')}</th>
            <th className="p-2">{t('admin.validation.evidence')}</th>
            <th className="p-2">{t('admin.validation.limitation')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {profile.evidence.map((record, i) => (
            <tr key={i}>
              <td className="p-2 font-mono text-xs">{record.clause}</td>
              <td className="p-2 font-mono text-xs">{record.checkId}</td>
              <td className="p-2 text-xs">
                <span
                  className={
                    record.result === 'pass'
                      ? 'text-semantic-success'
                      : record.result === 'fail'
                        ? 'text-semantic-error'
                        : 'text-foreground-muted'
                  }
                >
                  {record.result}
                </span>
              </td>
              <td className="p-2 text-xs text-foreground">{record.evidence}</td>
              <td className="p-2 text-xs text-foreground-muted">{record.limitation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ValidationAccessibilitySection({
  accessibility,
}: {
  accessibility: AccessibilityEvidence;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 text-xs">
      <div className="p-3 rounded bg-accent/10 border border-accent/20 text-foreground">
        <p className="font-semibold">{t('admin.validation.accessibilityNotice')}</p>
        {accessibility.manualReviewRequired && (
          <p className="text-foreground-muted mt-1">{t('admin.validation.manualReviewRequired')}</p>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-foreground mb-2">{t('admin.validation.metadata')}</h4>
        {accessibility.metadata.length === 0 ? (
          <p className="text-foreground-muted">{t('admin.validation.noMetadata')}</p>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-background-tertiary border-b border-border text-foreground-muted">
                <tr>
                  <th className="p-2">{t('admin.validation.property')}</th>
                  <th className="p-2">{t('admin.validation.value')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accessibility.metadata.map((m, i) => (
                  <tr key={i}>
                    <td className="p-2 font-mono text-accent">{m.key}</td>
                    <td className="p-2 text-foreground">
                      {m.value ?? t('admin.validation.present')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {(Object.keys(accessibility.profiles) as Array<'1.1' | '1.2-draft'>).map((key) => {
          const profile = accessibility.profiles[key];
          return (
            <div key={key} className="space-y-2 rounded border border-border p-3 bg-surface">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">
                  {t(key === '1.1' ? 'admin.validation.profile11' : 'admin.validation.profile12')}
                </span>
                <ProfileSpecBadge profile={profile} />
              </div>
              <p className="text-foreground-muted">
                {t('admin.validation.certification')}:{' '}
                {profile.certification === 'declared'
                  ? t('admin.validation.certificationDeclared')
                  : t('admin.validation.certificationNone')}
              </p>
              <div>
                <h5 className="font-semibold text-foreground mb-1">
                  {t('admin.validation.findingsTab')}
                </h5>
                <ProfileFindings profile={profile} />
              </div>
              <div>
                <h5 className="font-semibold text-foreground mb-1">
                  {t('admin.validation.evidenceLabel')}
                </h5>
                <ProfileEvidence profile={profile} />
              </div>
            </div>
          );
        })}
      </div>

      {accessibility.advisories.length > 0 && (
        <div>
          <h4 className="font-semibold text-foreground mb-2">{t('admin.validation.advisories')}</h4>
          <ul className="space-y-2">
            {accessibility.advisories.map((adv, i) => (
              <li
                key={i}
                className="p-2 rounded border border-border bg-surface flex justify-between gap-2"
              >
                <span className="text-foreground">{adv.message}</span>
                <span className="uppercase text-[10px] text-foreground-muted">
                  {adv.category}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

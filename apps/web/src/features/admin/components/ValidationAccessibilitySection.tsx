import { useTranslation } from '../../../hooks/useTranslation';
import type { AccessibilityEvidence } from '../../../lib/api/admin-validation';

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
                <span className="uppercase text-[10px] text-foreground-muted">{adv.category}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

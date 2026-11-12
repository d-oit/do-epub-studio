import { useTranslation } from '../../../hooks/useTranslation';
import { Button } from '@do-epub-studio/ui';

export type RemediationStatus = 'not_started' | 'in_progress' | 'remediated' | 'accepted_risk';

const REMEDIATION_STATUS_KEYS: readonly RemediationStatus[] = [
  'not_started',
  'in_progress',
  'remediated',
  'accepted_risk',
];

const CHECKLIST_ITEMS = [
  { key: 'headings-checked', labelKey: 'admin.validation.checklist.headings' },
  { key: 'contrast-checked', labelKey: 'admin.validation.checklist.contrast' },
  { key: 'alt-text-checked', labelKey: 'admin.validation.checklist.altText' },
  { key: 'navigation-checked', labelKey: 'admin.validation.checklist.navigation' },
] as const;

export interface ValidationRemediationSectionProps {
  status: RemediationStatus;
  setStatus: (s: RemediationStatus) => void;
  notes: string;
  setNotes: (n: string) => void;
  checklist: Record<string, boolean>;
  setChecklist: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSave: () => void | Promise<void>;
  isSaving: boolean;
  feedback: string | null;
}

export function ValidationRemediationSection({
  status,
  setStatus,
  notes,
  setNotes,
  checklist,
  setChecklist,
  onSave,
  isSaving,
  feedback,
}: ValidationRemediationSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 text-xs">
      {feedback && (
        <div className="p-2 rounded bg-semantic-success/10 border border-semantic-success/30 text-semantic-success">
          {feedback}
        </div>
      )}
      <div>
        <label
          htmlFor="remediation-status"
          className="block font-medium text-foreground-muted mb-1"
        >
          {t('admin.validation.remediationStatus')}
        </label>
        <select
          id="remediation-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as RemediationStatus)}
          className="rounded border border-border bg-surface px-3 py-1.5 text-foreground w-full sm:w-64"
        >
          {REMEDIATION_STATUS_KEYS.map((k) => (
            <option key={k} value={k}>
              {t(`admin.validation.remediationStatus.${k}`)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="block font-medium text-foreground-muted mb-2">
          {t('admin.validation.checklistTitle')}
        </span>
        <div className="space-y-2">
          {CHECKLIST_ITEMS.map(({ key, labelKey }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(checklist[key])}
                onChange={(e) => setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="rounded border-border text-accent focus:ring-accent"
              />
              <span className="text-foreground">{t(labelKey)}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="remediation-notes" className="block font-medium text-foreground-muted mb-1">
          {t('admin.validation.remediationNotes')}
        </label>
        <textarea
          id="remediation-notes"
          rows={4}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded border border-border bg-surface p-2 text-foreground focus:ring-accent"
          placeholder={t('admin.validation.remediationNotesPlaceholder')}
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void onSave()}
          disabled={isSaving}
        >
          {isSaving ? t('admin.validation.saving') : t('admin.validation.saveRemediation')}
        </Button>
      </div>
    </div>
  );
}

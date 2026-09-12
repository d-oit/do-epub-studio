import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { TranslationKeys } from '../../i18n/en';
import { useAuthStore } from '../../stores/auth';
import {
  createLocalEditorialPlugin,
  EDITORIAL_PLUGIN_CATEGORIES,
  categoryAvailability,
  milestone,
  QUALIFICATION_MILESTONES,
  type EditorialCategory,
  type EditorialReviewOutcome,
} from '@do-epub-studio/reader-core';
import {
  fetchAssistanceConsent,
  setAssistanceConsent,
} from '../../lib/api/creator';

const CATEGORY_LABELS: Record<EditorialCategory, TranslationKeys> = {
  spelling: 'asst.catSpelling',
  grammar: 'asst.catGrammar',
  story: 'asst.catStory',
  logic: 'asst.catLogic',
};

/** The engine-less plugin is the only implementation that ships. */
const editorialPlugin = createLocalEditorialPlugin();

interface AssistancePanelProps {
  bookId: string;
}

/**
 * Wave 4 (GOAP-999, AI-01/AI-02): editorial assistance surface.
 *
 * Every state shown here is derived, never assumed: a category reads its
 * availability from the qualification gate, and a review run reports whatever
 * the engine seam actually returns. With no engine bundled that is
 * `unavailable/engine_missing` — the panel says so instead of implying the
 * check ran and found nothing.
 */
export function AssistancePanel({ bookId }: AssistancePanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const token = sessionToken ?? '';

  const [consent, setConsent] = useState<{ allowed: boolean; cloudQualified: boolean } | null>(null);
  const [outcome, setOutcome] = useState<EditorialReviewOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setConsent(await fetchAssistanceConsent(bookId, token));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [bookId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const runCheck = async () => {
    setRunning(true);
    setError(null);
    try {
      const capability = editorialPlugin.capabilities.editorial;
      if (!capability) {
        setOutcome({ status: 'unavailable', reason: 'engine_missing' });
        return;
      }
      setOutcome(
        await capability.review({
          categories: EDITORIAL_PLUGIN_CATEGORIES,
          // No text is gathered while no engine exists; sending the manuscript
          // to an absent engine would be pointless and would widen exposure.
          chapterText: {},
          chapterSha256: {},
          references: {},
          styleRevision: null,
          language: null,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const toggleConsent = async () => {
    if (!consent || !token) return;
    setSaving(true);
    setError(null);
    try {
      setConsent(await setAssistanceConsent(bookId, !consent.allowed, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const cloud = milestone('cloud-provider');

  return (
    <section aria-label={t('asst.title')} className="mt-6 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">{t('asst.title')}</h2>

      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="mt-3 space-y-1">
        {EDITORIAL_PLUGIN_CATEGORIES.map((category) => {
          const availability = categoryAvailability(category);
          return (
            <li key={category} className="flex items-center justify-between gap-2 text-sm">
              <span>{t(CATEGORY_LABELS[category])}</span>
              <span className="rounded-full bg-background-tertiary px-2 py-0.5 text-xs text-foreground-muted">
                {availability === 'available' ? t('asst.runLabel') : t('asst.engineMissing')}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={running}
          onClick={() => void runCheck()}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background-secondary disabled:opacity-50"
        >
          {t('asst.runLabel')}
        </button>
        {outcome?.status === 'unavailable' && (
          <span role="status" className="text-sm text-foreground-muted">
            {outcome.reason === 'engine_missing' ? t('asst.unavailable') : t('asst.engineMissing')}
          </span>
        )}
        {outcome?.status === 'no_supported_findings' && (
          <span role="status" className="text-sm text-foreground-muted">{t('asst.noFindings')}</span>
        )}
        {outcome?.status === 'ok' && (
          <ul className="w-full space-y-2">
            {outcome.findings.map((finding, index) => (
              <li key={`${finding.category}-${index}`} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center gap-2 text-xs text-foreground-muted">
                  <span className="font-medium">{t(CATEGORY_LABELS[finding.category])}</span>
                  <span>
                    {finding.uncertainty === 'none'
                      ? t('asst.uncertaintyNone')
                      : finding.uncertainty === 'review_needed'
                        ? t('asst.uncertaintyReview')
                        : t('asst.uncertaintyContext')}
                  </span>
                </div>
                {/* Untrusted text: rendered as text nodes, never HTML. */}
                <p className="mt-1">{finding.explanation}</p>
                {finding.spans.map((span, spanIndex) => (
                  <blockquote key={spanIndex} className="mt-1 border-l-2 border-accent pl-2 text-foreground-muted">
                    {span.quote}
                  </blockquote>
                ))}
                {finding.replacement && (
                  <p className="mt-1">
                    <span className="font-medium">{t('asst.replacementLabel')}: </span>
                    {finding.replacement}
                  </p>
                )}
                {finding.referenceIds.length > 0 && (
                  <p className="mt-1 text-xs text-foreground-muted">
                    {t('asst.referencesLabel')}: {finding.referenceIds.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <h3 className="text-sm font-medium">{t('asst.cloudTitle')}</h3>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent?.allowed ?? false}
            disabled={saving || !consent}
            onChange={() => void toggleConsent()}
          />
          <span>{t('asst.cloudConsent')}</span>
        </label>
        {consent && !consent.allowed && (
          <p className="mt-1 text-xs text-foreground-muted">{t('asst.cloudConsentOff')}</p>
        )}
        {/* Dispatch is gated on the qualification milestone, not on consent. */}
        {(consent?.cloudQualified ?? false) ? (
          <button
            type="button"
            onClick={() => void runCheck()}
            className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm text-white"
          >
            {t('asst.dispatch')}
          </button>
        ) : (
          <p role="status" className="mt-2 text-xs text-foreground-muted">
            {t('asst.cloudNotQualified')}
          </p>
        )}
        {QUALIFICATION_MILESTONES.some((entry) => entry.status === 'met') && (
          <p className="mt-1 text-xs text-foreground-muted">{cloud.notes}</p>
        )}
      </div>
    </section>
  );
}

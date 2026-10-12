import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { TranslationKeys } from '../../i18n/en';
import { useAuthStore } from '../../stores/auth';
import {
  createTransformersEditorialPlugin,
  EDITORIAL_PLUGIN_CATEGORIES,
  effectiveCategoryAvailability,
  LANGUAGE_TOOL_EDITORIAL_CATEGORIES,
  milestone,
  QUALIFICATION_MILESTONES,
  TRANSFORMERS_EDITORIAL_CATEGORIES,
  type EditorialCategory,
  type ModelLoadProgress,
  type ModelLoadState,
} from '@do-epub-studio/reader-core';
import { fetchAssistanceConsent, setAssistanceConsent } from '../../lib/api/creator';
import { useEditorialReview } from './hooks/useEditorialReview';
import type { EditorialEngine } from './lib/editorial-dispatch';

const CATEGORY_LABELS: Record<EditorialCategory, TranslationKeys> = {
  spelling: 'asst.catSpelling',
  grammar: 'asst.catGrammar',
  story: 'asst.catStory',
  logic: 'asst.catLogic',
};

/**
 * Adapters are probed per category (GOAP-273): the quantized Transformers.js
 * engine answers story/logic once it has been explicitly prepared below; the
 * LanguageTool adapter (A2) is registered by useEditorialReview only when
 * VITE_LANGUAGETOOL_URL is configured (ADR-274: deployment-local service).
 * The engine-less local plugin is no longer dispatched — a category without a
 * present engine reports `engine_missing` instead of pretending a run
 * happened. Presence is always read from the capability, never inferred.
 */
const transformersPlugin = createTransformersEditorialPlugin();

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

  const review = useEditorialReview(bookId, token);
  const [consent, setConsent] = useState<{ allowed: boolean; cloudQualified: boolean } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [engineLoad, setEngineLoad] = useState<ModelLoadState | null>(null);
  const [engineProgress, setEngineProgress] = useState<ModelLoadProgress | null>(null);
  const [preparing, setPreparing] = useState(false);

  const engines = useMemo<EditorialEngine[]>(() => {
    const list: EditorialEngine[] = [
      { categories: TRANSFORMERS_EDITORIAL_CATEGORIES, plugin: transformersPlugin },
    ];
    if (review.languageToolPlugin) {
      list.push({
        categories: LANGUAGE_TOOL_EDITORIAL_CATEGORIES,
        plugin: review.languageToolPlugin,
      });
    }
    return list;
  }, [review.languageToolPlugin]);

  const enginePresent = (category: EditorialCategory): boolean => {
    if (TRANSFORMERS_EDITORIAL_CATEGORIES.includes(category)) {
      return transformersPlugin.capabilities.editorial?.hasEngine() ?? false;
    }
    return review.languageToolAvailable;
  };

  // Stable identity: the plugin's progress-listener Set dedupes by reference,
  // so a re-render must not register a second listener.
  const onEngineProgress = useCallback((progress: ModelLoadProgress) => {
    setEngineProgress(progress);
  }, []);

  /**
   * Labelled download: the ~500 MB model fetch happens only here, behind a
   * visible button with progress — never implicitly inside a review run
   * (the B1 load contract).
   */
  const prepareEngine = async () => {
    setPreparing(true);
    setError(null);
    try {
      setEngineLoad(await transformersPlugin.capabilities.editorial.load(onEngineProgress));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreparing(false);
    }
  };

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

  const runCheck = (): void => {
    void review.run(engines, EDITORIAL_PLUGIN_CATEGORIES);
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
        {t('asst.title')}
      </h2>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <ul className="mt-3 space-y-1">
        {EDITORIAL_PLUGIN_CATEGORIES.map((category) => {
          const availability = effectiveCategoryAvailability(category, {
            enginePresent: enginePresent(category),
          });
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

      {/* Grounded input: the manuscript text is loaded on demand through the
          creator's own read access (ADR-999 D1); nothing is extracted or
          hashed before this explicit action. */}
      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border p-3">
        {review.bookState === 'idle' && (
          <button
            type="button"
            onClick={() => void review.loadBook()}
            className="self-start rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background-secondary"
          >
            {t('asst.loadChapters')}
          </button>
        )}
        {review.bookState === 'loading' && (
          <span role="status" className="text-sm">
            {t('asst.loadingBook')}
          </span>
        )}
        {review.bookState === 'no_read_access' && (
          <p role="status" className="text-sm text-foreground-muted">
            {t('asst.noReadAccess')}
          </p>
        )}
        {review.bookState === 'error' && (
          <>
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {t('asst.loadFailed')}
            </p>
            <button
              type="button"
              onClick={() => void review.loadBook()}
              className="self-start rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background-secondary"
            >
              {t('asst.loadChapters')}
            </button>
          </>
        )}
        {review.bookState === 'ready' && (
          <>
            <span className="text-sm font-medium">{t('asst.chaptersLabel')}</span>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {review.chapters.map((chapter) => (
                <li key={chapter.ref}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={review.selected.includes(chapter.ref)}
                      onChange={() => review.toggleChapter(chapter.ref)}
                    />
                    {/* Untrusted title: rendered as a text node, never HTML. */}
                    <span>{chapter.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Story/logic engine: a labelled, user-initiated download with visible
          progress; review never triggers it (no implicit ~500 MB fetch). */}
      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border p-3">
        {engineLoad?.loaded ? (
          <span
            role="status"
            className="self-start rounded-full bg-background-tertiary px-2 py-0.5 text-xs text-foreground-muted"
          >
            {t('asst.engineReady')}
          </span>
        ) : preparing ? (
          <>
            <span className="text-sm">
              {t('asst.engineDownloading', { percent: engineProgress?.percent ?? 0 })}
            </span>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={engineProgress?.percent ?? 0}
              aria-label={t('asst.engineDownloading', { percent: engineProgress?.percent ?? 0 })}
              className="h-1.5 w-full overflow-hidden rounded-full bg-background-tertiary"
            >
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${engineProgress?.percent ?? 0}%` }}
              />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void prepareEngine()}
            className="self-start rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background-secondary disabled:opacity-50"
          >
            {t('asst.enginePrepare')}
          </button>
        )}
        <p className="text-xs text-foreground-muted">{t('asst.engineNote')}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={review.running}
          onClick={() => void runCheck()}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background-secondary disabled:opacity-50"
        >
          {t('asst.runLabel')}
        </button>
        {review.textRequired && (
          <span role="status" className="text-sm text-foreground-muted">
            {t('asst.textRequired')}
          </span>
        )}
        {review.error && review.bookState !== 'error' && (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            {t('asst.loadFailed')}
          </span>
        )}
        {review.outcome?.status === 'unavailable' && (
          <span role="status" className="text-sm text-foreground-muted">
            {review.outcome.reason === 'engine_missing'
              ? t('asst.unavailable')
              : t('asst.engineMissing')}
          </span>
        )}
        {review.outcome?.status === 'no_supported_findings' && (
          <span role="status" className="text-sm text-foreground-muted">
            {t('asst.noFindings')}
          </span>
        )}
        {review.outcome?.status === 'ok' && (
          <ul className="w-full space-y-2">
            {review.outcome.findings.map((finding, index) => (
              <li
                key={`${finding.category}-${index}`}
                className="rounded-lg border border-border p-3 text-sm"
              >
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
                  <blockquote
                    key={spanIndex}
                    className="mt-1 border-l-2 border-accent pl-2 text-foreground-muted"
                  >
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

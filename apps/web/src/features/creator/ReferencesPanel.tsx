import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { TFunction } from '../../hooks/useTranslation';
import { Spinner } from '@do-epub-studio/ui';
import type { TranslationKeys } from '../../i18n/en';
import { useAuthStore } from '../../stores/auth';
import {
  createReference,
  deleteReference,
  fetchReferences,
  fetchStyleProfile,
  saveStyleProfile,
  verifyReference,
  type BookReference,
  type ReferenceCreateInput,
  type ReferenceKind,
  type StyleProfileData,
} from '../../lib/api/creator';

const KINDS: Array<{ id: ReferenceKind; label: TranslationKeys }> = [
  { id: 'style_excerpt', label: 'ref.kindStyle' },
  { id: 'glossary_term', label: 'ref.kindGlossary' },
  { id: 'character_note', label: 'ref.kindCharacter' },
  { id: 'fact_note', label: 'ref.kindFact' },
  { id: 'chronology_note', label: 'ref.kindChronology' },
  { id: 'external_citation', label: 'ref.kindExternal' },
];

function kindLabel(t: TFunction, kind: string): string {
  return t(KINDS.find((k) => k.id === kind)?.label ?? 'ref.kindStyle');
}

interface ReferencesPanelProps {
  bookId: string;
}

/** Wave 3 (COL-03): creator-curated reference collection + style profile. */
export function ReferencesPanel({ bookId }: ReferencesPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const [references, setReferences] = useState<BookReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<ReferenceKind | ''>('');
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState<ReferenceKind>('glossary_term');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);
  const [evidenceNote, setEvidenceNote] = useState('');

  const [style, setStyle] = useState<StyleProfileData | null>(null);
  const [styleSaving, setStyleSaving] = useState(false);

  const token = sessionToken ?? '';

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [refs, profile] = await Promise.all([
        fetchReferences(bookId, token, kindFilter || undefined),
        fetchStyleProfile(bookId, token),
      ]);
      setReferences(refs);
      setStyle(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [bookId, token, kindFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    const input: ReferenceCreateInput = {
      kind: newKind,
      content: newContent.trim(),
      origin: newKind === 'external_citation' ? 'external' : 'creator',
    };
    if (newTitle.trim()) input.title = newTitle.trim();
    if (newKind === 'external_citation' && newUrl.trim()) input.sourceUrl = newUrl.trim();
    try {
      await createReference(bookId, input, token);
      setAdding(false);
      setNewTitle('');
      setNewContent('');
      setNewUrl('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReference(bookId, id, token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleVerify = async (ref: BookReference) => {
    if (!evidenceFor || !evidenceNote.trim()) return;
    try {
      await verifyReference(bookId, ref.id, !ref.verified, evidenceNote.trim(), token);
      setEvidenceFor(null);
      setEvidenceNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleApproveStyle = async () => {
    if (!style) return;
    setStyleSaving(true);
    try {
      await saveStyleProfile(
        bookId,
        {
          language: style.language ?? null,
          narrativePerson: style.narrativePerson ?? null,
          tense: style.tense ?? null,
          dialogueConventions: style.dialogueConventions ?? null,
          dialectNotes: style.dialectNotes ?? null,
          terminology: style.terminology ?? null,
          intentionalExceptions: style.intentionalExceptions ?? null,
          status: 'approved',
        },
        token,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStyleSaving(false);
    }
  };

  const patchStyle = (field: keyof StyleProfileData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setStyle((prev) => (prev ? { ...prev, [field]: e.target.value } : prev));
  };

  const styleField = (field: keyof StyleProfileData, label: string, rows = 2): React.JSX.Element => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <textarea
        value={String(style?.[field] ?? '')}
        onChange={patchStyle(field)}
        rows={rows}
        className="w-full rounded-lg border border-border bg-background p-2 text-sm"
      />
    </label>
  );

  return (
    <section aria-label={t('ref.title')} className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">{t('ref.title')}</h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg bg-accent px-3 py-1 text-sm text-white hover:opacity-90"
        >
          {t('ref.add')}
        </button>
      </div>

      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {adding && (
        <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t('ref.kindLabel')}</span>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as ReferenceKind)}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>{t(k.label)}</option>
              ))}
            </select>
          </label>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('ref.kindLabel')}
            aria-label={t('ref.kindLabel')}
            className="w-full rounded-lg border border-border bg-background p-2 text-sm"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            placeholder={t('ref.evidenceNote')}
            aria-label={t('ref.evidenceNote')}
            className="w-full rounded-lg border border-border bg-background p-2 text-sm"
          />
          {newKind === 'external_citation' && (
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder={'https://' /* eslint-disable-line i18next/no-literal-string -- URL scheme placeholder */}
              aria-label={'https://' /* eslint-disable-line i18next/no-literal-string -- URL scheme label */}
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!newContent.trim()}
              onClick={() => void handleCreate()}
              className="rounded-lg bg-accent px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              {t('ref.add')}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-border px-3 py-1 text-sm"
            >
              {t('feedback.withdraw')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3">
        <label className="text-sm">
          <span className="mr-2 text-foreground-muted">{t('ref.kindLabel')}</span>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as ReferenceKind | '')}
            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>{t(k.label)}</option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && (
        <div className="mt-3 flex justify-center" aria-label={t('ref.title')}>
          <Spinner />
        </div>
      )}
      {!isLoading && references.length === 0 && (
        <p className="mt-3 text-sm text-foreground-muted">{t('ref.empty')}</p>
      )}

      <ul className="mt-2 space-y-2">
        {references.map((ref) => (
          <li key={ref.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-xs text-foreground-muted">
              <span className="font-medium">{kindLabel(t, ref.kind)}</span>
              <span>·</span>
              <span>{`${t('ref.revisionPinned')} ${ref.revision}`}</span>
              {ref.origin === 'external' && (
                <span className={`rounded-full px-2 py-0.5 ${ref.verified ? 'bg-green-500/15 text-green-700 dark:text-green-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
                  {ref.verified ? t('ref.verified') : t('ref.unverified')}
                </span>
              )}
            </div>
            {ref.title && <p className="mt-1 text-sm font-medium">{ref.title}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm">{ref.content}</p>
            {ref.sourceUrl && (
              <a href={ref.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-xs text-accent underline underline-offset-2">
                {ref.sourceUrl}
              </a>
            )}
            <div className="mt-2 flex gap-2">
              {ref.origin === 'external' && (
                evidenceFor === ref.id ? (
                  <span className="flex w-full gap-2">
                    <input
                      value={evidenceNote}
                      onChange={(e) => setEvidenceNote(e.target.value)}
                      placeholder={t('ref.evidenceNote')}
                      aria-label={t('ref.evidenceNote')}
                      className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      disabled={!evidenceNote.trim()}
                      onClick={() => void handleVerify(ref)}
                      className="text-xs font-medium text-accent"
                    >
                      {ref.verified ? t('ref.unverify') : t('ref.verify')}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEvidenceFor(ref.id); setEvidenceNote(''); }}
                    className="text-xs text-foreground-muted underline underline-offset-2"
                  >
                    {ref.verified ? t('ref.unverify') : t('ref.verify')}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => void handleDelete(ref.id)}
                className="text-xs text-foreground-muted underline underline-offset-2"
              >
                {t('ref.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">{t('ref.styleTitle')}</h3>
          {style && (
            <span className={`rounded-full px-2 py-0.5 text-xs ${style.status === 'approved' ? 'bg-green-500/15 text-green-700 dark:text-green-300' : 'bg-background-tertiary text-foreground-muted'}`}>
              {style.status === 'approved' ? t('ref.styleApproved') : t('ref.styleDraft')}
            </span>
          )}
        </div>
        <div className="mt-3 space-y-3">
          {styleField('language', t('ref.styleLanguage'), 1)}
          {styleField('narrativePerson', t('ref.stylePerson'), 1)}
          {styleField('tense', t('ref.styleTense'), 1)}
          {styleField('dialogueConventions', t('ref.styleDialogue'))}
          {styleField('dialectNotes', t('ref.styleDialect'))}
          {styleField('terminology', t('ref.styleTerminology'))}
          {styleField('intentionalExceptions', t('ref.styleExceptions'))}
        </div>
        {style?.status !== 'approved' && (
          <button
            type="button"
            disabled={styleSaving}
            onClick={() => void handleApproveStyle()}
            className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {t('ref.styleApprove')}
          </button>
        )}
        {style?.status === 'approved' && style.approvedBy && (
          <p className="mt-2 text-xs text-foreground-muted">
            {t('ref.styleApproved')} · {style.approvedBy} · {style.approvedAt}
          </p>
        )}
      </div>
    </section>
  );
}

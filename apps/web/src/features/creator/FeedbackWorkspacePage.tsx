import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { Spinner } from '@do-epub-studio/ui';
import { useAuthStore } from '../../stores/auth';
import { useCreatorStore } from '../../stores/creator-feedback';
import {
  downloadExport,
  exportFeedback,
  fetchCreatorFeedback,
  fetchCreatorFeedbackDetail,
  replyAsCreator,
  setDisposition,
  type CreatorBook,
  type Disposition,
} from '../../lib/api/creator';
import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '../../lib/api/feedback';
import { createTraceId } from '@do-epub-studio/shared';
import { logClientEvent } from '../../lib/client-logger';
import type { TFunction } from '../../hooks/useTranslation';
import { ReferencesPanel } from './ReferencesPanel';

const STATUSES: FeedbackStatus[] = ['open', 'accepted', 'declined', 'resolved'];
const CATEGORIES: FeedbackCategory[] = ['general', 'grammar', 'spelling', 'story', 'logic', 'style'];

function statusLabel(t: TFunction, status: string): string {
  switch (status) {
    case 'accepted': return t('feedback.statusAccepted');
    case 'declined': return t('feedback.statusDeclined');
    case 'resolved': return t('feedback.statusResolved');
    default: return t('feedback.statusOpen');
  }
}

export function FeedbackWorkspacePage(): React.JSX.Element {
  const { t } = useTranslation();
  const { bookId } = useParams<{ bookId: string }>();
  const sessionToken = useAuthStore((s) => s.sessionToken);

  const books = useCreatorStore((s) => s.books);
  const items = useCreatorStore((s) => s.items);
  const statusFilter = useCreatorStore((s) => s.statusFilter);
  const categoryFilter = useCreatorStore((s) => s.categoryFilter);
  const selectedId = useCreatorStore((s) => s.selectedId);
  const isLoading = useCreatorStore((s) => s.isLoading);
  const error = useCreatorStore((s) => s.error);

  const [replyText, setReplyText] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const book: CreatorBook | undefined = books.find((b) => b.id === bookId);

  const load = useCallback(async () => {
    if (!bookId || !sessionToken) return;
    const store = useCreatorStore.getState();
    store.setLoading(true);
    store.setError(null);
    try {
      const list = await fetchCreatorFeedback(bookId, sessionToken, {
        ...(store.statusFilter ? { status: store.statusFilter } : {}),
        ...(store.categoryFilter ? { category: store.categoryFilter } : {}),
      });
      store.setItems(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      store.setError(message);
      logClientEvent({
        level: 'error', traceId: createTraceId(),
        event: 'creator.feedback.failed',
        error: { name: 'Error', message },
      });
    } finally {
      store.setLoading(false);
    }
  }, [bookId, sessionToken]);

  useEffect(() => {
    useCreatorStore.getState().selectBook(bookId ?? null);
    useCreatorStore.getState().resetWorkspace();
    void load();
  }, [bookId, load]);

  const selected2 = useMemo(() => items.find((f) => f.id === selectedId) ?? null, [items, selectedId]);

  const openDetail = useCallback(
    async (item: FeedbackItem) => {
      if (!bookId || !sessionToken) return;
      useCreatorStore.getState().selectItem(item.id);
      try {
        const detail = await fetchCreatorFeedbackDetail(bookId, item.id, sessionToken);
        useCreatorStore.getState().upsertItem(detail);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      }
    },
    [bookId, sessionToken],
  );

  const sendReply = useCallback(async () => {
    if (!bookId || !sessionToken || !selectedId || !replyText.trim()) return;
    setActionError(null);
    try {
      const updated = await replyAsCreator(bookId, selectedId, replyText.trim(), sessionToken);
      useCreatorStore.getState().upsertItem(updated);
      setReplyText('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }, [bookId, sessionToken, selectedId, replyText]);

  const applyDisposition = useCallback(
    async (disposition: Disposition) => {
      if (!bookId || !sessionToken || !selectedId) return;
      setActionError(null);
      try {
        const updated = await setDisposition(bookId, selectedId, disposition, sessionToken);
        useCreatorStore.getState().upsertItem(updated);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      }
    },
    [bookId, sessionToken, selectedId],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exportSelected = useCallback(async () => {
    if (!bookId || !sessionToken || selected.size === 0) return;
    setActionError(null);
    try {
      const { items: exported } = await exportFeedback(bookId, [...selected], sessionToken);
      downloadExport(book?.slug ?? bookId, exported);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }, [bookId, sessionToken, selected, book]);

  const store = useCreatorStore.getState();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <nav aria-label={'breadcrumb'} /* eslint-disable-line i18next/no-literal-string -- ARIA landmark label constant */ className="text-sm text-foreground-muted">
        <Link to={'/creator'} /* eslint-disable-line i18next/no-literal-string -- route path constant */ className="underline underline-offset-2">{t('creator.title')}</Link>
      </nav>
      <h1 className="mt-1 font-display text-2xl font-semibold">{book?.title ?? bookId}</h1>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="mr-2 text-foreground-muted">{t('creator.filterStatus')}</span>
          <select
            value={statusFilter ?? ''}
            onChange={(e) => {
              store.setStatusFilter((e.target.value || null) as FeedbackStatus | null);
              void load();
            }}
            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(t, s)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mr-2 text-foreground-muted">{t('creator.filterCategory')}</span>
          <select
            value={categoryFilter ?? ''}
            onChange={(e) => {
              store.setCategoryFilter((e.target.value || null) as FeedbackCategory | null);
              void load();
            }}
            className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => void exportSelected()}
            className="rounded-lg bg-accent px-3 py-1 text-sm text-white hover:opacity-90"
          >
            {t('creator.exportSelected')} ({selected.size})
          </button>
        )}
      </div>

      {actionError && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{actionError}</p>
      )}

      {isLoading && items.length === 0 && (
        <div className="mt-8 flex justify-center"><Spinner /></div>
      )}

      {error && items.length === 0 && (
        <div className="mt-8 rounded-lg border border-border p-4">
          <p role="alert" className="text-sm text-foreground-muted">{t('creator.loadError')}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 text-sm font-medium text-accent underline underline-offset-2"
          >
            {t('creator.retry')}
          </button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <p className="mt-8 rounded-lg border border-border bg-background-secondary p-4 text-sm text-foreground-muted">
          {t('creator.emptyNoFeedback')}
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <div className={`flex items-start gap-2 rounded-lg border p-3 ${selectedId === item.id ? 'border-accent' : 'border-border'}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    aria-label={t('creator.exportSelected')}
                    className="mt-1 h-4 w-4"
                  />
                  <button
                    type="button"
                    onClick={() => void openDetail(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="text-xs text-foreground-muted">
                      {item.kind} · {item.category} · {statusLabel(t, item.status)}
                    </span>
                    <span className="block truncate text-sm font-medium">{item.body}</span>
                    {item.anchor.selectedText && (
                      <span className="block truncate text-xs text-foreground-muted">
                        “{item.anchor.selectedText}”
                      </span>
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-border p-4">
            {!selected2 && (
              <p className="text-sm text-foreground-muted">{t('creator.referencesLabel')}</p>
            )}
            {selected2 && (
              <article>
                <h2 className="text-sm text-foreground-muted">
                  {selected2.kind} · {selected2.category} · {statusLabel(t, selected2.status)}
                </h2>
                <section aria-label={t('creator.referencesLabel')} className="mt-2 rounded-lg bg-background-secondary p-3 text-sm">
                  {selected2.anchor.chapterRef && <p>{`${t('creator.referencesLabel')}: ${selected2.anchor.chapterRef}`}</p>}
                  {selected2.anchor.cfi && <p className="break-all font-mono text-xs">{selected2.anchor.cfi}</p>}
                  {selected2.anchor.selectedText && (
                    <blockquote className="mt-1 border-l-2 border-accent pl-2">{selected2.anchor.selectedText}</blockquote>
                  )}
                </section>
                <p className="mt-3 text-sm">{selected2.body}</p>
                {selected2.proposedText && (
                  <p className="mt-2 text-sm">
                    <span className="font-medium">{t('creator.proposedLabel')}: </span>
                    {selected2.proposedText}
                  </p>
                )}

                {selected2.replies.length > 0 && (
                  <ul className="mt-3 space-y-1 border-l-2 border-border pl-3">
                    {selected2.replies.map((reply) => (
                      <li key={reply.id} className="text-sm">
                        <span className="text-xs text-foreground-muted">{reply.authorRole} · </span>
                        {reply.body}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t('creator.replyPlaceholder')}
                    aria-label={t('creator.replyPlaceholder')}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void sendReply()}
                    disabled={!replyText.trim()}
                    className="rounded-lg bg-accent px-3 py-1 text-sm text-white disabled:opacity-50"
                  >
                    {t('feedback.submit')}
                  </button>
                </div>

                {selected2.status !== 'withdrawn' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected2.kind === 'suggestion' && selected2.status === 'open' && (
                      <>
                        <button type="button" onClick={() => void applyDisposition('accepted')} className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-background-secondary">
                          {t('creator.accept')}
                        </button>
                        <button type="button" onClick={() => void applyDisposition('declined')} className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-background-secondary">
                          {t('creator.decline')}
                        </button>
                      </>
                    )}
                    {selected2.kind === 'comment' && selected2.status === 'open' && (
                      <button type="button" onClick={() => void applyDisposition('resolved')} className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-background-secondary">
                        {t('creator.resolve')}
                      </button>
                    )}
                    {selected2.status !== 'open' && (
                      <button type="button" onClick={() => void applyDisposition('open')} className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-background-secondary">
                        {t('creator.reopen')}
                      </button>
                    )}
                  </div>
                )}
              </article>
            )}
          </div>
        </div>

      )}

      <ReferencesPanel bookId={bookId ?? ''} />
    </div>
  );
}

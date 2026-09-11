import { useCallback, useEffect, useState } from 'react';
import { createTraceId } from '@do-epub-studio/shared';
import { useAuthStore } from '../../../stores/auth';
import { useReaderStore } from '../../../stores/reader';
import {
  createFeedback,
  fetchOwnFeedback,
  withdrawFeedback,
  replyToFeedback,
  type FeedbackCategory,
  type FeedbackDelivery,
  type FeedbackItem,
  type FeedbackKind,
} from '../../../lib/api/feedback';
import {
  saveFeedbackDraft,
  loadFeedbackDrafts,
  deleteFeedbackDraft,
  deleteFeedbackDraftByMutation,
  subscribeFeedbackDrafts,
  type FeedbackDraft,
} from '../../../lib/offline/feedback-drafts';
import { generateMutationId, queueFeedbackSubmission } from '../../../lib/offline/sync';
import { logClientEvent } from '../../../lib/client-logger';

export interface ComposerSelection {
  text: string;
  cfiRange: string;
  chapterRef: string;
}

export interface ComposerInput {
  kind: FeedbackKind;
  category: FeedbackCategory;
  body: string;
  proposedText?: string;
  selection: ComposerSelection;
}

function draftToItem(draft: FeedbackDraft): FeedbackItem {
  return {
    id: `draft:${draft.id}`,
    kind: draft.kind,
    category: draft.category as FeedbackItem['category'],
    body: draft.body,
    proposedText: draft.proposedText ?? null,
    anchor: {
      bookFileId: draft.anchor.bookFileId,
      chapterRef: draft.anchor.chapterRef,
      cfi: draft.anchor.cfi,
      selectedText: draft.anchor.selectedText,
      prefix: draft.anchor.prefix,
      suffix: draft.anchor.suffix,
    },
    status: 'open',
    isOwn: true,
    replyCount: 0,
    replies: [],
    createdAt: new Date(draft.createdAt).toISOString(),
    updatedAt: new Date(draft.updatedAt).toISOString(),
    delivery: draft.delivery,
  };
}

function toDraft(
  bookId: string,
  ownerEmail: string,
  input: ComposerInput,
  delivery: FeedbackDelivery,
  error?: string,
): FeedbackDraft {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    bookId,
    ownerEmail,
    kind: input.kind,
    category: input.category,
    body: input.body,
    proposedText: input.proposedText,
    anchor: {
      chapterRef: input.selection.chapterRef || undefined,
      cfi: input.selection.cfiRange || undefined,
      selectedText: input.selection.text,
    },
    mutationId: generateMutationId(),
    delivery,
    error,
    createdAt: now,
    updatedAt: now,
  };
}
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'Error';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}


function isNetworkFailure(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return true;
  if (typeof error !== 'object' || error === null) return true;
  if (!('status' in error)) return true;
  return typeof error.status !== 'number';
}

export function useFeedbackComposer(bookId: string | null): {
  items: FeedbackItem[];
  composerOpen: boolean;
  composerKind: FeedbackKind;
  composerSelection: ComposerSelection | null;
  composerError: string | null;
  submitting: boolean;
  openComposer: (kind: FeedbackKind, selection: ComposerSelection) => void;
  closeComposer: () => void;
  submit: (input: ComposerInput) => Promise<FeedbackItem>;
  retryDraft: (draftItemId: string) => Promise<void>;
  withdraw: (id: string) => Promise<void>;
  reply: (id: string, text: string) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const email = useAuthStore((s) => s.email);
  const canComment = useAuthStore((s) => s.capabilities?.canComment ?? false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerKind, setComposerKind] = useState<FeedbackKind>('comment');
  const [composerSelection, setComposerSelection] = useState<ComposerSelection | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const items = useReaderStore((s) => s.feedbackItems);

  const refresh = useCallback(async () => {
    if (!bookId || !sessionToken || !email) return;
    // Losing book access locks cached private drafts: only merge drafts when
    // the current session can still read this book.
    try {
      const [serverItems, drafts] = await Promise.all([
        fetchOwnFeedback(bookId, sessionToken).catch(() => null),
        loadFeedbackDrafts(bookId, email),
      ]);
      const merged: FeedbackItem[] = [];
      if (serverItems) {
        for (const item of serverItems) merged.push({ ...item, delivery: 'sent' as const });
      }
      for (const draft of drafts) {
        if (draft.delivery === 'sent') continue;
        merged.push(draftToItem(draft));
      }
      merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      useReaderStore.getState().setFeedbackItems(merged);
    } catch (err) {
      logClientEvent({
        level: 'error', traceId: createTraceId(),
        event: 'feedback.refresh.failed',
        error: { name: errorName(err), message: errorMessage(err) },
      });
    }
  }, [bookId, sessionToken, email]);

  useEffect(() => {
    void refresh();
    return subscribeFeedbackDrafts(() => {
      void refresh();
    });
  }, [refresh]);

  const openComposer = useCallback((kind: FeedbackKind, selection: ComposerSelection) => {
    setComposerKind(kind);
    setComposerSelection({
      text: selection.text,
      cfiRange: selection.cfiRange,
      chapterRef: selection.chapterRef,
    });
    setComposerError(null);
    setComposerOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setComposerSelection(null);
    setComposerError(null);
  }, []);

  const persistOffline = useCallback(
    async (draft: FeedbackDraft) => {
      await saveFeedbackDraft(draft);
      await queueFeedbackSubmission({
        bookId: draft.bookId,
        draftId: draft.id,
        kind: draft.kind,
        category: draft.category as FeedbackItem['category'],
        body: draft.body,
        proposedText: draft.proposedText,
        anchor: draft.anchor,
        mutationId: draft.mutationId,
      });
      useReaderStore.getState().upsertFeedbackItem(draftToItem(draft));
    },
    [],
  );

  const submit = useCallback(
    async (input: ComposerInput): Promise<FeedbackItem> => {
      if (!bookId || !sessionToken || !email) {
        throw new Error('Not authenticated');
      }
      if (!canComment) {
        throw new Error('Contribution not permitted');
      }
      setSubmitting(true);
      setComposerError(null);
      try {
        const draft = toDraft(bookId, email, input, 'pending');
        if (!navigator.onLine) {
          await persistOffline(draft);
          return draftToItem(draft);
        }
        try {
          const item = await createFeedback(
            bookId,
            {
              kind: input.kind,
              category: input.category,
              body: input.body,
              proposedText: input.proposedText,
              anchor: {
                chapterRef: input.selection.chapterRef || undefined,
                cfi: input.selection.cfiRange || undefined,
                selectedText: input.selection.text,
              },
              mutationId: draft.mutationId,
            },
            sessionToken,
          );
          const sent = { ...item, delivery: 'sent' as const };
          useReaderStore.getState().upsertFeedbackItem(sent);
          await deleteFeedbackDraftByMutation(draft.mutationId).catch(() => undefined);
          return sent;
        } catch (err) {
          if (isNetworkFailure(err)) {
            await persistOffline(draft);
            return draftToItem(draft);
          }
          const blocked = { ...draft, delivery: 'blocked' as const, error: errorMessage(err) };
          await saveFeedbackDraft(blocked);
          setComposerError(errorMessage(err));
          throw err;
        }
      } finally {
        setSubmitting(false);
      }
    },
    [bookId, sessionToken, email, canComment, persistOffline],
  );

  const retryDraft = useCallback(
    async (draftItemId: string) => {
      const id = draftItemId.startsWith('draft:') ? draftItemId.slice('draft:'.length) : draftItemId;
      if (!bookId || !sessionToken || !email) return;
      const drafts = await loadFeedbackDrafts(bookId, email);
      const draft = drafts.find((d) => d.id === id);
      if (!draft) return;
      await deleteFeedbackDraft(draft.id);
      useReaderStore.getState().removeFeedbackItem(draftItemId);
      await submit({
        kind: draft.kind,
        category: draft.category as FeedbackItem['category'],
        body: draft.body,
        proposedText: draft.proposedText,
        selection: {
          text: draft.anchor.selectedText,
          cfiRange: draft.anchor.cfi ?? '',
          chapterRef: draft.anchor.chapterRef ?? '',
        },
      });
    },
    [bookId, sessionToken, email, submit],
  );

  const withdraw = useCallback(
    async (id: string) => {
      if (!bookId || !sessionToken) return;
      if (id.startsWith('draft:')) {
        await deleteFeedbackDraft(id.slice('draft:'.length));
        useReaderStore.getState().removeFeedbackItem(id);
        return;
      }
      const item = await withdrawFeedback(bookId, id, sessionToken);
      useReaderStore.getState().upsertFeedbackItem({ ...item, delivery: 'sent' });
    },
    [bookId, sessionToken],
  );

  const reply = useCallback(
    async (id: string, text: string) => {
      if (!bookId || !sessionToken) return;
      const item = await replyToFeedback(bookId, id, text, sessionToken);
      useReaderStore.getState().upsertFeedbackItem({ ...item, delivery: 'sent' });
    },
    [bookId, sessionToken],
  );

  return {
    items,
    composerOpen,
    composerKind,
    composerSelection,
    composerError,
    submitting,
    openComposer,
    closeComposer,
    submit,
    retryDraft,
    withdraw,
    reply,
    refresh,
  };
}

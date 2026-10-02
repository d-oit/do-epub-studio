import { useCallback } from 'react';
import { createTraceId } from '@do-epub-studio/shared';
import { useReaderStore, useAuthStore } from '../../../stores';
import type { Highlight } from '../../../stores';
import { createHighlight, updateHighlight, deleteHighlight } from '../../../lib/api/annotations';
import { saveAnnotation, persistAnnotationCreation, syncAll } from '../../../lib/offline';
import type { AnnotationEntry } from '../../../lib/offline';
import type { SelectionData } from '../components/annotations';
import { logClientEvent } from '../../../lib/client-logger';
import { useCommentHandlers, type CommentHandlersReturn } from './useCommentHandlers';

export { useCommentHandlers } from './useCommentHandlers';
// ─── Highlight handlers ───────────────────────────────────────────────────────

interface HighlightHandlersReturn {
  handleCreateHighlight: (color: string, selection: SelectionData | null) => Promise<void>;
  handleEditHighlight: (highlightId: string, note: string) => Promise<void>;
  handleDeleteHighlight: (highlightId: string) => Promise<void>;
}

export function useHighlightHandlers(): HighlightHandlersReturn {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const bookId = useAuthStore((state) => state.bookId);

  const addHighlight = useReaderStore((s) => s.addHighlight);
  const updateHighlightInStore = useReaderStore((s) => s.updateHighlight);
  const removeHighlight = useReaderStore((s) => s.removeHighlight);

  // Optimistic store

  const handleCreateHighlight = useCallback(
    async (color: string, selection: SelectionData | null) => {
      if (!selection) return;

      const authState = useAuthStore.getState();
      const token = authState.sessionToken;
      const activeBookId = authState.bookId;

      if (authState.sessionExpiresAt && authState.sessionExpiresAt <= Date.now()) {
        authState.logout('expired');
        const err = new Error('Session expired');
        (err as Error & { status?: number }).status = 401;
        throw err;
      }

      if (!token || !activeBookId) {
        const err = new Error('Session expired');
        (err as Error & { status?: number }).status = 401;
        throw err;
      }

      if (!authState.capabilities?.canRead || !authState.capabilities?.canHighlight) {
        const err = new Error('Access denied');
        (err as Error & { status?: number }).status = 403;
        throw err;
      }

      const mutationId = crypto.randomUUID();
      const localId = `local-annotation-${mutationId}`;
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      const offlineEntry: AnnotationEntry = {
        id: localId,
        bookId: activeBookId,
        type: 'highlight',
        cfi: selection.cfiRange,
        text: selection.text,
        chapter: selection.chapterRef,
        color,
        createdAt: nowMs,
        updatedAt: nowMs,
        synced: false,
        mutationId,
      };

      const localHighlight: Highlight = {
        id: localId,
        chapterRef: selection.chapterRef,
        cfiRange: selection.cfiRange,
        selectedText: selection.text,
        note: null,
        color,
        createdAt: nowIso,
        updatedAt: nowIso,
        syncState: 'pending',
      };

      if (!navigator.onLine) {
        await persistAnnotationCreation(offlineEntry, token);
        addHighlight(localHighlight);
        return;
      }

      try {
        const serverHighlight = await createHighlight(
          activeBookId,
          {
            mutationId,
            locator: {
              chapterRef: selection.chapterRef,
              cfi: selection.cfiRange,
              selectedText: selection.text,
            },
            color,
          },
          token,
        );

        try {
          await saveAnnotation({
            id: serverHighlight.id,
            bookId: activeBookId,
            type: 'highlight',
            cfi: serverHighlight.cfiRange ?? selection.cfiRange,
            text: serverHighlight.selectedText,
            chapter: serverHighlight.chapterRef ?? selection.chapterRef,
            color: serverHighlight.color,
            createdAt: new Date(serverHighlight.createdAt).getTime(),
            updatedAt: new Date(serverHighlight.updatedAt).getTime(),
            synced: true,
            mutationId,
          });
        } catch (storageErr) {
          logClientEvent({
            level: 'warn',
            traceId: createTraceId(),
            event: 'annotation.cache.failed',
            error: {
              name: (storageErr as Error).name,
              message: (storageErr as Error).message,
            },
          });
        }

        addHighlight(serverHighlight);
      } catch (err) {
        const isTransportError = err instanceof TypeError || (err as Error).name === 'TimeoutError';

        if (isTransportError && token === useAuthStore.getState().sessionToken) {
          await persistAnnotationCreation(offlineEntry, token);
          addHighlight(localHighlight);
          void syncAll();
          return;
        }

        logClientEvent({
          level: 'error',
          traceId: createTraceId(),
          event: 'annotation.create-highlight.failed',
          error: {
            name: (err as Error).name,
            message: (err as Error).message,
            stack: (err as Error).stack,
          },
        });
        throw err;
      }
    },
    [addHighlight],
  );

  const handleEditHighlight = useCallback(
    async (highlightId: string, note: string) => {
      if (!sessionToken || !bookId) return;
      try {
        await updateHighlight(bookId, highlightId, { note }, sessionToken);
        updateHighlightInStore(highlightId, { note, updatedAt: new Date().toISOString() });
      } catch (err) {
        logClientEvent({
          level: 'error',
          traceId: createTraceId(),
          event: 'annotation.edit-highlight.failed',
          error: { name: (err as Error).name, message: (err as Error).message },
        });
      }
    },
    [sessionToken, bookId, updateHighlightInStore],
  );

  const handleDeleteHighlight = useCallback(
    async (highlightId: string) => {
      if (!sessionToken || !bookId) return;
      try {
        await deleteHighlight(bookId, highlightId, sessionToken);
        removeHighlight(highlightId);
      } catch (err) {
        logClientEvent({
          level: 'error',
          traceId: createTraceId(),
          event: 'annotation.delete-highlight.failed',
          error: { name: (err as Error).name, message: (err as Error).message },
        });
      }
    },
    [sessionToken, bookId, removeHighlight],
  );

  return { handleCreateHighlight, handleEditHighlight, handleDeleteHighlight };
}

// ─── Orchestrator (thin combinator) ─────────────────────────────────────────

interface AnnotationHandlersReturn extends HighlightHandlersReturn, CommentHandlersReturn {}

export function useAnnotationHandlers(): AnnotationHandlersReturn {
  const highlightHandlers = useHighlightHandlers();
  const commentHandlers = useCommentHandlers();
  return { ...highlightHandlers, ...commentHandlers };
}

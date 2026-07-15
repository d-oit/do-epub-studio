import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createTraceId } from '@do-epub-studio/shared';
import { useReaderStore, useAuthStore } from '../../../stores';
import {
  createHighlight,
  createComment,
  updateHighlight as apiUpdateHighlight,
  deleteHighlight,
  updateComment as apiUpdateComment,
} from '../../../lib/api/annotations';
import { saveAnnotation, queueSync, generateMutationId } from '../../../lib/offline';
import type { SelectionData } from '../components/annotations';
import { logClientEvent } from '../../../lib/client-logger';

export function useReaderHandlers() {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const bookId = useAuthStore((state) => state.bookId);
  const addHighlight = useReaderStore((state) => state.addHighlight);
  const updateHighlight = useReaderStore((state) => state.updateHighlight);
  const removeHighlight = useReaderStore((state) => state.removeHighlight);
  const addComment = useReaderStore((state) => state.addComment);
  const updateComment = useReaderStore((state) => state.updateComment);
  const comments = useReaderStore(useShallow((state) => state.comments));

  const handleCreateHighlight = useCallback(
    async (color: string, selection: SelectionData | null, setSelection: (s: null) => void) => {
      if (!selection || !sessionToken || !bookId) return;
      try {
        const mutationId = generateMutationId();
        const highlight = await createHighlight(
          bookId,
          {
            locator: {
              chapterRef: selection.chapterRef,
              cfi: selection.cfiRange,
              selectedText: selection.text,
            },
            color,
          },
          sessionToken,
        );
        addHighlight(highlight);
        setSelection(null);
        if (!navigator.onLine) {
          await saveAnnotation({
            id: highlight.id,
            bookId,
            type: 'highlight',
            cfi: selection.cfiRange,
            text: selection.text,
            color,
            createdAt: Date.now(),
            synced: false,
            mutationId,
          });
          await queueSync('annotation', { bookId, annotation: highlight }, mutationId);
        }
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'reader.create-highlight.failed', error: { name: (err as Error).name, message: (err as Error).message } });
      }
    },
    [sessionToken, bookId, addHighlight],
  );

  const handleCreateComment = useCallback(
    async (
      text: string,
      selection: SelectionData | null,
      setSelection: (s: null) => void,
      setShowCommentInput: (b: boolean) => void,
      setIsCommentMode: (b: boolean) => void,
    ) => {
      if (!selection || !sessionToken || !bookId) return;
      try {
        const comment = await createComment(
          bookId,
          {
            locator: {
              chapterRef: selection.chapterRef,
              cfi: selection.cfiRange,
              selectedText: selection.text,
            },
            body: text,
          },
          sessionToken,
        );
        addComment(comment);
        setSelection(null);
        setShowCommentInput(false);
        setIsCommentMode(false);
        if (!navigator.onLine) {
          const mutationId = generateMutationId();
          await saveAnnotation({
            id: comment.id,
            bookId,
            type: 'comment',
            cfi: selection.cfiRange,
            text: selection.text,
            comment: text,
            chapter: selection.chapterRef,
            createdAt: Date.now(),
            synced: false,
            mutationId,
          });
          await queueSync('annotation', { bookId, annotation: comment }, mutationId);
        }
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'reader.create-comment.failed', error: { name: (err as Error).name, message: (err as Error).message } });
      }
    },
    [sessionToken, bookId, addComment],
  );

  const handleResolveComment = useCallback(
    async (commentId: string) => {
      if (!sessionToken || !bookId) return;
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return;
      const newStatus = comment.status === 'resolved' ? 'open' : 'resolved';
      try {
        if (!navigator.onLine) {
          // Plan 998: persist status mutation to IndexedDB for offline restore
          const mutationId = generateMutationId();
          await saveAnnotation({
            id: commentId,
            bookId,
            type: 'comment',
            cfi: comment.cfiRange ?? '',
            comment: comment.body,
            chapter: comment.chapterRef ?? undefined,
            createdAt: new Date(comment.createdAt).getTime(),
            synced: false,
            mutationId,
            status: newStatus,
            visibility: comment.visibility,
          });
          await queueSync(
            'annotation',
            { bookId, annotation: { id: commentId, status: newStatus }, action: 'resolve' },
            mutationId,
          );
        } else {
          await apiUpdateComment(commentId, { status: newStatus }, sessionToken);
        }
        updateComment(commentId, {
          status: newStatus,
          resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : null,
        });
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'reader.resolve-comment.failed', error: { name: (err as Error).name, message: (err as Error).message } });
      }
    },
    [sessionToken, bookId, comments, updateComment],
  );

  const handleReplyToComment = useCallback(
    async (parentId: string, text: string) => {
      if (!sessionToken || !bookId) return;
      try {
        const comment = await createComment(
          bookId,
          { body: text, parentCommentId: parentId },
          sessionToken,
        );
        addComment(comment);
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'reader.reply-comment.failed', error: { name: (err as Error).name, message: (err as Error).message } });
      }
    },
    [sessionToken, bookId, addComment],
  );

  const handleEditComment = useCallback(
    async (commentId: string, text: string) => {
      if (!sessionToken) return;
      try {
        await apiUpdateComment(commentId, { body: text }, sessionToken);
        updateComment(commentId, { body: text, updatedAt: new Date().toISOString() });
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'reader.edit-comment.failed', error: { name: (err as Error).name, message: (err as Error).message } });
      }
    },
    [sessionToken, updateComment],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!sessionToken) return;
      try {
        await apiUpdateComment(commentId, { status: 'deleted' }, sessionToken);
        updateComment(commentId, { status: 'deleted' });
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'reader.delete-comment.failed', error: { name: (err as Error).name, message: (err as Error).message } });
      }
    },
    [sessionToken, updateComment],
  );

  const handleEditHighlight = useCallback(
    async (highlightId: string, note: string) => {
      if (!sessionToken || !bookId) return;
      try {
        await apiUpdateHighlight(bookId, highlightId, { note }, sessionToken);
        updateHighlight(highlightId, { note, updatedAt: new Date().toISOString() });
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'reader.edit-highlight.failed', error: { name: (err as Error).name, message: (err as Error).message } });
      }
    },
    [sessionToken, bookId, updateHighlight],
  );

  const handleDeleteHighlight = useCallback(
    async (highlightId: string) => {
      if (!sessionToken || !bookId) return;
      try {
        await deleteHighlight(bookId, highlightId, sessionToken);
        removeHighlight(highlightId);
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'reader.delete-highlight.failed', error: { name: (err as Error).name, message: (err as Error).message } });
      }
    },
    [sessionToken, bookId, removeHighlight],
  );

  return {
    handleCreateHighlight,
    handleCreateComment,
    handleResolveComment,
    handleReplyToComment,
    handleEditComment,
    handleDeleteComment,
    handleEditHighlight,
    handleDeleteHighlight,
  };
}

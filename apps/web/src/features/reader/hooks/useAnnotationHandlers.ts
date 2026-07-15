import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createTraceId } from '@do-epub-studio/shared';
import { useReaderStore, useAuthStore } from '../../../stores';
import type { Highlight, Comment } from '../../../stores';
import {
  createHighlight,
  createComment,
  updateHighlight,
  deleteHighlight,
  updateComment,
} from '../../../lib/api/annotations';
import { saveAnnotation, queueSync, generateMutationId } from '../../../lib/offline';
import type { SelectionData } from '../components/annotations';
import { useOptimisticAnnotationStore } from './useOptimisticAnnotations';
import { logClientEvent } from '../../../lib/client-logger';

interface AnnotationHandlersReturn {
  handleCreateHighlight: (color: string, selection: SelectionData | null) => Promise<void>;
  handleCreateComment: (text: string, selection: SelectionData | null) => Promise<void>;
  handleResolveComment: (commentId: string) => Promise<void>;
  handleReplyToComment: (parentId: string, text: string) => Promise<void>;
  handleEditComment: (commentId: string, text: string) => Promise<void>;
  handleDeleteComment: (commentId: string) => Promise<void>;
  handleEditHighlight: (highlightId: string, note: string) => Promise<void>;
  handleDeleteHighlight: (highlightId: string) => Promise<void>;
}

export function useAnnotationHandlers(): AnnotationHandlersReturn {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const bookId = useAuthStore((state) => state.bookId);

  const addHighlight = useReaderStore((s) => s.addHighlight);
  const updateHighlightInStore = useReaderStore((s) => s.updateHighlight);
  const removeHighlight = useReaderStore((s) => s.removeHighlight);
  const addComment = useReaderStore((s) => s.addComment);
  const updateCommentInStore = useReaderStore((s) => s.updateComment);
  const comments = useReaderStore(useShallow((s) => s.comments));

  const {
    addOptimisticHighlight,
    addOptimisticComment,
    removeOptimistic,
  } = useOptimisticAnnotationStore();

  const handleCreateHighlight = useCallback(
    async (color: string, selection: SelectionData | null) => {
      if (!selection || !sessionToken || !bookId) return;
      const tempId = `optimistic-hl-${Date.now()}`;
      const placeholder: Highlight = {
        id: tempId,
        chapterRef: selection.chapterRef,
        cfiRange: selection.cfiRange,
        selectedText: selection.text,
        note: null,
        color,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addOptimisticHighlight(placeholder);
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
        // Commit real highlight; useOptimistic will re-sync base state to the store.
        addHighlight(highlight);

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
        // Roll back the optimistic placeholder on error.
        removeOptimistic(tempId, 'highlight');
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'annotation.create-highlight.failed', error: { name: (err as Error).name, message: (err as Error).message, stack: (err as Error).stack } });
        throw err;
      }
    },
    [sessionToken, bookId, addHighlight, addOptimisticHighlight, removeOptimistic],
  );

  const handleCreateComment = useCallback(
    async (text: string, selection: SelectionData | null) => {
      if (!selection || !sessionToken || !bookId) return;
      const tempId = `optimistic-cm-${Date.now()}`;
      const placeholder: Comment = {
        id: tempId,
        userEmail: useAuthStore.getState().email ?? 'you',
        chapterRef: selection.chapterRef,
        cfiRange: selection.cfiRange,
        selectedText: selection.text,
        body: text,
        status: 'open',
        visibility: 'shared',
        parentCommentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: null,
      };
      addOptimisticComment(placeholder);
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
        removeOptimistic(tempId, 'comment');
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'annotation.create-comment.failed', error: { name: (err as Error).name, message: (err as Error).message, stack: (err as Error).stack } });
        throw err;
      }
    },
    [sessionToken, bookId, addComment, addOptimisticComment, removeOptimistic],
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
          await updateComment(commentId, { status: newStatus }, sessionToken);
        }
        updateCommentInStore(commentId, {
          status: newStatus,
          resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : null,
        });
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'annotation.resolve-comment.failed', error: { name: (err as Error).name, message: (err as Error).message } });
      }
    },
    [sessionToken, bookId, comments, updateCommentInStore],
  );

  const handleReplyToComment = useCallback(
    async (parentId: string, text: string) => {
      if (!sessionToken || !bookId) return;
      const parent = comments.find((c) => c.id === parentId);
      const tempId = `optimistic-reply-${Date.now()}`;
      const placeholder: Comment = {
        id: tempId,
        userEmail: useAuthStore.getState().email ?? 'you',
        chapterRef: parent?.chapterRef ?? null,
        cfiRange: parent?.cfiRange ?? null,
        selectedText: parent?.selectedText ?? null,
        body: text,
        status: 'open',
        visibility: 'shared',
        parentCommentId: parentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: null,
      };
      addOptimisticComment(placeholder);
      try {
        const comment = await createComment(
          bookId,
          { body: text, parentCommentId: parentId },
          sessionToken,
        );
        addComment(comment);
      } catch (err) {
        removeOptimistic(tempId, 'comment');
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'annotation.reply-comment.failed', error: { name: (err as Error).name, message: (err as Error).message, stack: (err as Error).stack } });
        throw err;
      }
    },
    [sessionToken, bookId, addComment, addOptimisticComment, removeOptimistic, comments],
  );

  const handleEditComment = useCallback(
    async (commentId: string, text: string) => {
      if (!sessionToken) return;
      try {
        await updateComment(commentId, { body: text }, sessionToken);
        updateCommentInStore(commentId, { body: text, updatedAt: new Date().toISOString() });
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'annotation.edit-comment.failed', error: { name: (err as Error).name, message: (err as Error).message } });
      }
    },
    [sessionToken, updateCommentInStore],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!sessionToken) return;
      try {
        await updateComment(commentId, { status: 'deleted' }, sessionToken);
        updateCommentInStore(commentId, { status: 'deleted' });
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'annotation.delete-comment.failed', error: { name: (err as Error).name, message: (err as Error).message } });
      }
    },
    [sessionToken, updateCommentInStore],
  );

  const handleEditHighlight = useCallback(
    async (highlightId: string, note: string) => {
      if (!sessionToken || !bookId) return;
      try {
        await updateHighlight(bookId, highlightId, { note }, sessionToken);
        updateHighlightInStore(highlightId, { note, updatedAt: new Date().toISOString() });
      } catch (err) {
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'annotation.edit-highlight.failed', error: { name: (err as Error).name, message: (err as Error).message } });
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
        logClientEvent({ level: 'error', traceId: createTraceId(), event: 'annotation.delete-highlight.failed', error: { name: (err as Error).name, message: (err as Error).message } });
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

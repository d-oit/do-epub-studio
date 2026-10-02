import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createTraceId } from '@do-epub-studio/shared';
import { useReaderStore, useAuthStore } from '../../../stores';
import type { Comment } from '../../../stores';
import { createComment, updateComment } from '../../../lib/api/annotations';
import {
  saveAnnotation,
  queueSync,
  generateMutationId,
  persistAnnotationCreation,
  syncAll,
} from '../../../lib/offline';
import type { AnnotationEntry } from '../../../lib/offline';
import type { SelectionData } from '../components/annotations';
import { useOptimisticAnnotationStore } from './useOptimisticAnnotations';
import { logClientEvent } from '../../../lib/client-logger';

export interface CommentHandlersReturn {
  handleCreateComment: (text: string, selection: SelectionData | null) => Promise<void>;
  handleResolveComment: (commentId: string) => Promise<void>;
  handleReplyToComment: (parentId: string, text: string) => Promise<void>;
  handleEditComment: (commentId: string, text: string) => Promise<void>;
  handleDeleteComment: (commentId: string) => Promise<void>;
}

// ─── Comment creation, resolution and moderation ──────────────────────────────

export function useCommentHandlers(): CommentHandlersReturn {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const bookId = useAuthStore((state) => state.bookId);

  const addComment = useReaderStore((s) => s.addComment);
  const updateCommentInStore = useReaderStore((s) => s.updateComment);
  const comments = useReaderStore(useShallow((s) => s.comments));

  const { addOptimisticComment, removeOptimistic } = useOptimisticAnnotationStore();

  const handleCreateComment = useCallback(
    async (text: string, selection: SelectionData | null) => {
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

      if (!authState.capabilities?.canRead || !authState.capabilities?.canComment) {
        const err = new Error('Access denied');
        (err as Error & { status?: number }).status = 403;
        throw err;
      }

      const mutationId = crypto.randomUUID();
      const localId = `local-annotation-${mutationId}`;
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();
      const rawEmail = authState.email ?? 'reader@example.com';
      const maskedDisplayName = rawEmail.slice(0, 2) + '***';

      const offlineEntry: AnnotationEntry = {
        id: localId,
        bookId: activeBookId,
        type: 'comment',
        cfi: selection.cfiRange,
        text: selection.text,
        comment: text,
        chapter: selection.chapterRef,
        createdAt: nowMs,
        updatedAt: nowMs,
        displayName: maskedDisplayName,
        status: 'open',
        visibility: 'shared',
        synced: false,
        mutationId,
      };

      const localComment: Comment = {
        id: localId,
        displayName: maskedDisplayName,
        isOwn: true,
        chapterRef: selection.chapterRef,
        cfiRange: selection.cfiRange,
        selectedText: selection.text,
        body: text,
        status: 'open',
        visibility: 'shared',
        parentCommentId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        resolvedAt: null,
        syncState: 'pending',
      };

      if (!navigator.onLine) {
        await persistAnnotationCreation(offlineEntry, token);
        addComment(localComment);
        return;
      }

      try {
        const serverComment = await createComment(
          activeBookId,
          {
            mutationId,
            locator: {
              chapterRef: selection.chapterRef,
              cfi: selection.cfiRange,
              selectedText: selection.text,
            },
            body: text,
            visibility: 'shared',
          },
          token,
        );

        try {
          await saveAnnotation({
            id: serverComment.id,
            bookId: activeBookId,
            type: 'comment',
            cfi: serverComment.cfiRange ?? selection.cfiRange,
            text: serverComment.selectedText ?? selection.text,
            comment: serverComment.body,
            chapter: serverComment.chapterRef ?? selection.chapterRef,
            createdAt: new Date(serverComment.createdAt).getTime(),
            updatedAt: new Date(serverComment.updatedAt).getTime(),
            displayName: serverComment.displayName,
            status: serverComment.status === 'deleted' ? 'open' : serverComment.status,
            visibility: serverComment.visibility,
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

        addComment(serverComment);
      } catch (err) {
        const isTransportError = err instanceof TypeError || (err as Error).name === 'TimeoutError';

        if (isTransportError && token === useAuthStore.getState().sessionToken) {
          await persistAnnotationCreation(offlineEntry, token);
          addComment(localComment);
          void syncAll();
          return;
        }

        logClientEvent({
          level: 'error',
          traceId: createTraceId(),
          event: 'annotation.create-comment.failed',
          error: {
            name: (err as Error).name,
            message: (err as Error).message,
            stack: (err as Error).stack,
          },
        });
        throw err;
      }
    },
    [addComment],
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
        logClientEvent({
          level: 'error',
          traceId: createTraceId(),
          event: 'annotation.resolve-comment.failed',
          error: { name: (err as Error).name, message: (err as Error).message },
        });
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
        displayName: useAuthStore.getState().email?.split('@')[0] ?? 'you',
        isOwn: true,
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
        logClientEvent({
          level: 'error',
          traceId: createTraceId(),
          event: 'annotation.reply-comment.failed',
          error: {
            name: (err as Error).name,
            message: (err as Error).message,
            stack: (err as Error).stack,
          },
        });
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
        logClientEvent({
          level: 'error',
          traceId: createTraceId(),
          event: 'annotation.edit-comment.failed',
          error: { name: (err as Error).name, message: (err as Error).message },
        });
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
        logClientEvent({
          level: 'error',
          traceId: createTraceId(),
          event: 'annotation.delete-comment.failed',
          error: { name: (err as Error).name, message: (err as Error).message },
        });
      }
    },
    [sessionToken, updateCommentInStore],
  );

  return {
    handleCreateComment,
    handleResolveComment,
    handleReplyToComment,
    handleEditComment,
    handleDeleteComment,
  };
}

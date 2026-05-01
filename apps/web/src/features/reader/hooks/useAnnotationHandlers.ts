import { useCallback } from 'react';
import { useReaderStore, useAuthStore } from '../../../stores';
import {
  createHighlight,
  createComment,
  updateHighlight,
  deleteHighlight,
  updateComment,
} from '../../../lib/api/annotations';
import { saveAnnotation, queueSync, generateMutationId } from '../../../lib/offline';
import type { SelectionData } from '../components/annotations';

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

  const { addHighlight, updateHighlightInStore, removeHighlight } = useReaderStore((state) => ({
    addHighlight: state.addHighlight,
    updateHighlightInStore: state.updateHighlight,
    removeHighlight: state.removeHighlight,
  }));
  const { addComment, updateCommentInStore, comments } = useReaderStore((state) => ({
    addComment: state.addComment,
    updateCommentInStore: state.updateComment,
    comments: state.comments,
  }));

  const handleCreateHighlight = useCallback(
    async (color: string, selection: SelectionData | null) => {
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
        console.error('Failed to create highlight', err);
      }
    },
    [sessionToken, bookId, addHighlight],
  );

  const handleCreateComment = useCallback(
    async (text: string, selection: SelectionData | null) => {
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
        console.error('Failed to create comment', err);
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
        await updateComment(commentId, { status: newStatus }, sessionToken);
        updateCommentInStore(commentId, {
          status: newStatus,
          resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : null,
        });
      } catch (err) {
        console.error('Failed to update comment', err);
      }
    },
    [sessionToken, bookId, comments, updateCommentInStore],
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
        console.error('Failed to reply to comment', err);
      }
    },
    [sessionToken, bookId, addComment],
  );

  const handleEditComment = useCallback(
    async (commentId: string, text: string) => {
      if (!sessionToken) return;

      try {
        await updateComment(commentId, { body: text }, sessionToken);
        updateCommentInStore(commentId, { body: text, updatedAt: new Date().toISOString() });
      } catch (err) {
        console.error('Failed to edit comment', err);
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
        console.error('Failed to delete comment', err);
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
        console.error('Failed to update highlight', err);
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
        console.error('Failed to delete highlight', err);
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

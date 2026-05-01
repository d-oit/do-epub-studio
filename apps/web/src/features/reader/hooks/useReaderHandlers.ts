import { useCallback } from 'react';
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

export function useReaderHandlers() {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const bookId = useAuthStore((state) => state.bookId);
  const addHighlight = useReaderStore((state) => state.addHighlight);
  const updateHighlight = useReaderStore((state) => state.updateHighlight);
  const removeHighlight = useReaderStore((state) => state.removeHighlight);
  const addComment = useReaderStore((state) => state.addComment);
  const updateComment = useReaderStore((state) => state.updateComment);
  const comments = useReaderStore((state) => state.comments);

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
        console.error('Failed to create highlight', err);
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
        await apiUpdateComment(commentId, { status: newStatus }, sessionToken);
        updateComment(commentId, {
          status: newStatus,
          resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : null,
        });
      } catch (err) {
        console.error('Failed to update comment', err);
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
        console.error('Failed to reply to comment', err);
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
        console.error('Failed to edit comment', err);
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
        console.error('Failed to delete comment', err);
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
        console.error('Failed to update highlight', err);
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

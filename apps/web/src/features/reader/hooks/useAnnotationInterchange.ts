import { useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, useReaderStore } from '../../../stores';
import type { AnnotationInterchangeDocument } from '@do-epub-studio/schema';
import {
  buildAnnotationInterchange,
  mergeAnnotationInterchangeDocuments,
  parseAnnotationInterchange,
} from '../lib/annotation-interchange';
import {
  fetchAnnotationInterchange,
  saveAnnotationInterchange,
} from '../../../lib/api/annotation-interchange';

export function useAnnotationInterchange(bookId: string | null, bookTitle: string | null) {
  const token = useAuthStore((state) => state.sessionToken);
  const { highlights, comments, bookmarks } = useReaderStore(
    useShallow((state) => ({
      highlights: state.highlights,
      comments: state.comments,
      bookmarks: state.bookmarks,
    })),
  );
  const setHighlights = useReaderStore((state) => state.setHighlights);
  const setComments = useReaderStore((state) => state.setComments);
  const setBookmarks = useReaderStore((state) => state.setBookmarks);
  const storedDocument = useRef<AnnotationInterchangeDocument | null>(null);

  useEffect(() => {
    if (!bookId || !token) return;
    let active = true;
    void fetchAnnotationInterchange(bookId, token)
      .then((document) => {
        if (!active || !document) return;
        storedDocument.current = document;
        const parsed = parseAnnotationInterchange(JSON.stringify(document), bookId);
        setHighlights(mergeById(useReaderStore.getState().highlights, parsed.state.highlights));
        setComments(mergeById(useReaderStore.getState().comments, parsed.state.comments));
        setBookmarks(mergeById(useReaderStore.getState().bookmarks, parsed.state.bookmarks));
      })
      .catch(() => {
        /* The regular annotation APIs remain authoritative if profile storage is unavailable. */
      });
    return () => {
      active = false;
    };
  }, [bookId, token, setHighlights, setComments, setBookmarks]);

  const exportDraft = useCallback(() => {
    if (!bookId || !token) throw new Error('Sign in to export annotations');
    const payload =
      storedDocument.current ??
      buildAnnotationInterchange({
        bookId,
        bookTitle: bookTitle ?? 'Book',
        state: { highlights, comments, bookmarks },
      });
    const text = JSON.stringify(payload, null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(bookTitle || 'book').replace(/[\\/:*?"<>|]+/g, '_')}-annotations-1.0-draft.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [bookId, token, bookTitle, highlights, comments, bookmarks]);

  const importDraft = useCallback(
    async (file: File) => {
      if (!bookId || !token) throw new Error('Sign in to import annotations');
      if (file.size > 1_000_000) throw new Error('Import exceeds the 1 MB limit');
      const text = await file.text();
      const { document: incoming, state } = parseAnnotationInterchange(text, bookId);
      const existing = storedDocument.current ?? (await fetchAnnotationInterchange(bookId, token));
      const document = mergeAnnotationInterchangeDocuments(existing, incoming);
      await saveAnnotationInterchange(bookId, document, token);
      storedDocument.current = document;
      setHighlights(mergeById(useReaderStore.getState().highlights, state.highlights));
      setComments(mergeById(useReaderStore.getState().comments, state.comments));
      setBookmarks(mergeById(useReaderStore.getState().bookmarks, state.bookmarks));
    },
    [bookId, token, setHighlights, setComments, setBookmarks],
  );

  return { exportDraft, importDraft };
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const records = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) records.set(item.id, item);
  return Array.from(records.values());
}

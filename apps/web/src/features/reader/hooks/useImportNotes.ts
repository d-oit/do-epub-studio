import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useReaderStore } from '../../../stores';
import { importNotesFromMarkdown, type NotesImportResult } from './useExportNotes';

interface UseImportNotesReturn {
  handleImportNotes: (file: File) => Promise<NotesImportResult>;
}

export function useImportNotes(): UseImportNotesReturn {
  const setHighlights = useReaderStore((s) => s.setHighlights);
  const setComments = useReaderStore((s) => s.setComments);
  const setBookmarks = useReaderStore((s) => s.setBookmarks);
  const { highlights, comments, bookmarks } = useReaderStore(
    useShallow((s) => ({
      highlights: s.highlights,
      comments: s.comments,
      bookmarks: s.bookmarks,
    })),
  );

  const handleImportNotes = useCallback(
    async (file: File): Promise<NotesImportResult> => {
      const text = await file.text();
      const result = importNotesFromMarkdown(text);
      if (!result.ok && result.highlights.length + result.comments.length + result.bookmarks.length === 0) {
        return result;
      }

      const mergedHighlights = mergeById(highlights, result.highlights);
      const mergedComments = mergeById(comments, result.comments);
      const mergedBookmarks = mergeById(bookmarks, result.bookmarks);
      setHighlights(mergedHighlights);
      setComments(mergedComments);
      setBookmarks(mergedBookmarks);
      return { ...result, ok: true };
    },
    [highlights, comments, bookmarks, setHighlights, setComments, setBookmarks],
  );

  return { handleImportNotes };
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of existing) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, item);
  return Array.from(map.values());
}

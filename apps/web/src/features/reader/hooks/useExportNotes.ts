import { useCallback } from 'react';
import { useReaderStore } from '../../../stores';

interface UseExportNotesReturn {
  handleExportNotes: (bookTitle: string | null | undefined) => void;
}

export function useExportNotes(): UseExportNotesReturn {
  const highlights = useReaderStore((state) => state.highlights);
  const comments = useReaderStore((state) => state.comments);

  const handleExportNotes = useCallback(
    (bookTitle: string | null | undefined) => {
      const notesContent = [
        `# ${bookTitle || 'Book'} - Exported Notes`,
        ``,
        `## Highlights`,
        ``,
        ...highlights.map(
          (h) => `- ${h.selectedText} (${h.color})${h.note ? ` — ${h.note}` : ''}`,
        ),
        ``,
        `## Comments`,
        ``,
        ...comments
          .filter((c) => c.status !== 'deleted')
          .map(
            (c) =>
              `- ${c.body}${c.selectedText ? ` — "${c.selectedText.slice(0, 80)}..."` : ''}`,
          ),
        ``,
      ].join('\n');

      const blob = new Blob([notesContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bookTitle || 'notes'}-notes.md`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [highlights, comments],
  );

  return { handleExportNotes };
}

import type { AnnotationLocator } from '@do-epub-studio/shared';

/**
 * Shared constants and types for the notes export/import feature.
 *
 * Extracted from `useExportNotes.ts` so that `export-notes-markdown.ts`
 * can import these without creating a circular dependency back to the
 * hook module. `NotesImportResult` stays in the hook because it depends
 * on store entity types (Highlight, Comment, Bookmark).
 */
export const NOTES_FORMAT_VERSION = 1 as const;
export const NOTES_MIME_TYPE = 'text/markdown' as const;

export interface ExportedAnnotationBase {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportedHighlight extends ExportedAnnotationBase {
  type: 'highlight';
  selectedText: string;
  color: string;
  note: string | null;
  locator: AnnotationLocator | null;
}

export interface ExportedComment extends ExportedAnnotationBase {
  type: 'comment';
  body: string;
  status: 'open' | 'resolved' | 'deleted';
  visibility: 'shared' | 'internal' | 'resolved';
  parentCommentId: string | null;
  selectedText: string | null;
  locator: AnnotationLocator | null;
}

export interface ExportedBookmark extends ExportedAnnotationBase {
  type: 'bookmark';
  label: string | null;
  locator: AnnotationLocator;
}

export type ExportedAnnotation = ExportedHighlight | ExportedComment | ExportedBookmark;

export interface NotesExport {
  format: 'do-epub-studio-notes';
  version: typeof NOTES_FORMAT_VERSION;
  exportedAt: string;
  bookTitle: string;
  bookId: string | null;
  annotations: ExportedAnnotation[];
}

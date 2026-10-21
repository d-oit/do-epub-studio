// Canonical local entry for a settled annotation creation.
//
// ADR-278 warn-zone extraction from `sync.ts`: the mapping from the server's
// annotation payload to the persisted local record is one concern, and keeping
// it here leaves `sync.ts` on the queue's control flow.
//
// The mapping is deliberately field-by-field rather than a spread: the local
// `AnnotationEntry` has its own field names (`cfi` vs `cfiRange`, `comment`
// vs `body`, `createdAt` as a number vs a string) and its own status
// normalization (a deleted comment is stored as open, because a deletion is
// not a local annotation state).

import type { AnnotationEntry } from './types';
import type { AnnotationCreateResult } from './annotation-sync';

/**
 * Build the persisted local record for an annotation the server accepted.
 *
 * @param result the server's annotation payload
 * @param bookId the book the annotation belongs to
 * @param mutationId the mutation id that produced it
 */
export function buildCanonicalAnnotationEntry(
  result: AnnotationCreateResult,
  bookId: string | null,
  mutationId: string,
): AnnotationEntry {
  if (result.type === 'highlight') {
    const highlight = result.item;
    return {
      id: highlight.id,
      bookId: bookId ?? '',
      type: 'highlight',
      cfi: highlight.cfiRange ?? '',
      text: highlight.selectedText,
      chapter: highlight.chapterRef ?? undefined,
      color: highlight.color,
      createdAt: new Date(highlight.createdAt).getTime(),
      updatedAt: new Date(highlight.updatedAt).getTime(),
      synced: true,
      mutationId,
    };
  }

  const comment = result.item;
  return {
    id: comment.id,
    bookId: bookId ?? '',
    type: 'comment',
    cfi: comment.cfiRange ?? '',
    text: comment.selectedText ?? undefined,
    comment: comment.body,
    chapter: comment.chapterRef ?? undefined,
    displayName: comment.displayName,
    status: comment.status === 'deleted' ? 'open' : comment.status,
    visibility: comment.visibility,
    createdAt: new Date(comment.createdAt).getTime(),
    updatedAt: new Date(comment.updatedAt).getTime(),
    synced: true,
    mutationId,
  };
}

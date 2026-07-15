import type { AnnotationEntry } from '../../../lib/offline';
import type { Highlight, Comment, Bookmark } from '../../../stores';

export function mapOfflineHighlight(a: AnnotationEntry): Highlight {
  return {
    id: a.id,
    chapterRef: a.chapter ?? null,
    cfiRange: a.cfi,
    selectedText: a.text ?? '',
    note: a.comment ?? null,
    color: a.color ?? 'yellow',
    createdAt: new Date(a.createdAt).toISOString(),
    updatedAt: new Date(a.createdAt).toISOString(),
  };
}

export function mapOfflineComment(a: AnnotationEntry): Comment {
  // status/visibility default to 'open'/'shared' because the offline schema
  // (AnnotationEntry) only caches newly-created comments, which are always
  // open and shared. Status mutations (resolve/unresolve) while offline are
  // not persisted to IndexedDB — see plan 998 for the tracking issue.
  return {
    id: a.id,
    userEmail: '',
    chapterRef: a.chapter ?? null,
    cfiRange: a.cfi,
    selectedText: a.text ?? null,
    body: a.comment ?? '',
    status: 'open',
    visibility: 'shared',
    parentCommentId: null,
    createdAt: new Date(a.createdAt).toISOString(),
    updatedAt: new Date(a.createdAt).toISOString(),
    resolvedAt: null,
  };
}

export function mapOfflineBookmark(a: AnnotationEntry): Bookmark {
  return {
    id: a.id,
    locator: { cfi: a.cfi },
    label: a.text ?? '',
    createdAt: new Date(a.createdAt).toISOString(),
  };
}

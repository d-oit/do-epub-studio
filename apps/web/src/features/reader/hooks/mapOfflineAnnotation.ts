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
  // Plan 998: use stored status/visibility when available (offline resolve/unresolve).
  // Legacy entries without these fields default to 'open'/'shared'.
  const status = a.status ?? 'open';
  const visibility = a.visibility ?? 'shared';
  return {
    id: a.id,
    userEmail: '',
    chapterRef: a.chapter ?? null,
    cfiRange: a.cfi,
    selectedText: a.text ?? null,
    body: a.comment ?? '',
    status,
    visibility,
    parentCommentId: null,
    createdAt: new Date(a.createdAt).toISOString(),
    updatedAt: new Date(a.createdAt).toISOString(),
    resolvedAt: status === 'resolved' ? new Date(a.createdAt).toISOString() : null,
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

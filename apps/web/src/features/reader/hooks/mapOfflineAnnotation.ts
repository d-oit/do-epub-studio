import type { AnnotationEntry } from '../../../lib/offline';
import type { Highlight, Comment, Bookmark } from '../../../stores';

export function mapOfflineHighlight(a: AnnotationEntry): Highlight {
  const syncState = !a.synced ? (a.syncError ? 'failed' : 'pending') : undefined;
  return {
    id: a.id,
    chapterRef: a.chapter ?? null,
    cfiRange: a.cfi,
    selectedText: a.text ?? '',
    note: a.comment ?? null,
    color: a.color ?? 'yellow',
    createdAt: new Date(a.createdAt).toISOString(),
    updatedAt: new Date(a.updatedAt ?? a.createdAt).toISOString(),
    syncState,
    syncError: a.syncError,
  };
}

export function mapOfflineComment(a: AnnotationEntry): Comment {
  const status = a.status ?? 'open';
  const visibility = a.visibility ?? 'shared';
  const syncState = !a.synced ? (a.syncError ? 'failed' : 'pending') : undefined;
  return {
    id: a.id,
    displayName: a.displayName ?? '',
    isOwn: true,
    chapterRef: a.chapter ?? null,
    cfiRange: a.cfi,
    selectedText: a.text ?? null,
    body: a.comment ?? '',
    status,
    visibility,
    parentCommentId: null,
    createdAt: new Date(a.createdAt).toISOString(),
    updatedAt: new Date(a.updatedAt ?? a.createdAt).toISOString(),
    resolvedAt: status === 'resolved' ? new Date(a.updatedAt ?? a.createdAt).toISOString() : null,
    syncState,
    syncError: a.syncError,
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

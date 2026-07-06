import { create } from 'zustand';
import type { ConflictRecord, ConflictResolutionResult } from '../lib/offline/conflict-resolution';
import { ConflictResolutionStrategy } from '../lib/offline/conflict-resolution';
import type { AnnotationLocator } from '@do-epub-studio/shared';

export type PageDirection = 'ltr' | 'rtl' | 'default';
export type WritingMode = 'horizontal-tb' | 'vertical-rl' | 'vertical-lr';
export type ReaderPanel = 'toc' | 'settings' | 'comments' | 'bookmarks' | 'info' | 'search' | 'fl-controls' | null;
export type ReaderSpread = 'auto' | 'none' | 'both';
/** Discrete zoom steps for fixed-layout EPUBs. 1.0 = 100%. */
export type ReaderZoom = 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 2.0;

export interface ReadingProgress {
  locator: AnnotationLocator | null;
  progressPercent: number;
  updatedAt: string | null;
}

export interface Bookmark {
  id: string;
  locator: AnnotationLocator;
  label: string | null;
  createdAt: string;
}

export interface Highlight {
  id: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string;
  note: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  userEmail: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string | null;
  body: string;
  status: 'open' | 'resolved' | 'deleted';
  visibility: 'shared' | 'internal' | 'resolved';
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  replies?: Comment[];
}

interface ReaderState {
  progress: ReadingProgress;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  comments: Comment[];
  currentChapter: string | null;
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  pendingSyncCount: number;
  permissionStatus: 'valid' | 'invalid' | 'checking';
  bookDirection: PageDirection;
  bookWritingMode: WritingMode;
  isFixedLayout: boolean;
  activePanel: ReaderPanel;
  readerSpread: ReaderSpread;
  readerZoom: ReaderZoom;
  setProgress: (progress: ReadingProgress) => void;
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (id: string) => void;
  setBookmarks: (bookmarks: Bookmark[]) => void;
  addHighlight: (highlight: Highlight) => void;
  removeHighlight: (id: string) => void;
  setHighlights: (highlights: Highlight[]) => void;
  updateHighlight: (id: string, updates: Partial<Highlight>) => void;
  addComment: (comment: Comment) => void;
  updateComment: (id: string, updates: Partial<Comment>) => void;
  setComments: (comments: Comment[]) => void;
  setCurrentChapter: (chapter: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setOffline: (offline: boolean) => void;
  setPendingSyncCount: (count: number) => void;
  setPermissionStatus: (status: 'valid' | 'invalid' | 'checking') => void;
  conflicts: ConflictRecord[];
  setConflicts: (conflicts: ConflictRecord[]) => void;
  addConflict: (conflict: ConflictRecord) => void;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote') => ConflictResolutionResult | null;
  clearConflicts: () => void;
  setBookDirection: (direction: PageDirection) => void;
  setBookWritingMode: (writingMode: WritingMode) => void;
  setIsFixedLayout: (isFixedLayout: boolean) => void;
  setReaderSpread: (spread: ReaderSpread) => void;
  setReaderZoom: (zoom: ReaderZoom) => void;
  setActivePanel: (panel: ReaderPanel) => void;
  togglePanel: (panel: ReaderPanel) => void;
}

/**
 * O(n) single-pass tree rebuild using a Map. Flattens the nested tree via
 * an iterative stack, then reconstructs parent→child relationships in one pass.
 */
function rebuildTree(
  comments: Comment[],
  newComment?: Comment,
  updateId?: string,
  updates?: Partial<Comment>,
): Comment[] {
  // Flatten nested tree iteratively
  const flat: Comment[] = [];
  const stack: Comment[] = [...comments];
  while (stack.length > 0) {
    const c = stack.pop();
    if (!c) break;
    flat.push(c);
    if (c.replies) {
      for (let i = c.replies.length - 1; i >= 0; i--) {
        stack.push(c.replies[i]);
      }
    }
  }

  if (newComment) flat.push(newComment);

  // Single-pass: create shallow copies and index by id
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  for (const c of flat) {
    const copy: Comment = c.id === updateId ? { ...c, ...updates, replies: [] } : { ...c, replies: [] };
    map.set(copy.id, copy);
  }

  for (const c of flat) {
    const node = map.get(c.id);
    if (!node) continue;
    if (!c.parentCommentId) {
      roots.push(node);
    } else {
      const parent = map.get(c.parentCommentId);
      if (parent?.replies) {
        parent.replies.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}

export const useReaderStore = create<ReaderState>((set) => ({
  progress: { locator: null, progressPercent: 0, updatedAt: null },
  bookmarks: [],
  highlights: [],
  comments: [],
  currentChapter: null,
  isLoading: false,
  error: null,
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  pendingSyncCount: 0,
  permissionStatus: 'checking',
  bookDirection: 'default',
  bookWritingMode: 'horizontal-tb',
  isFixedLayout: false,
  activePanel: null,
  readerSpread: 'auto',
  readerZoom: 1.0,
  conflicts: [],
  setConflicts: (conflicts) => set({ conflicts }),
  addConflict: (conflict) =>
    set((state) => ({
      conflicts: state.conflicts.some((c) => c.id === conflict.id)
        ? state.conflicts.map((c) => (c.id === conflict.id ? conflict : c))
        : [...state.conflicts, conflict],
    })),
  resolveConflict: (conflictId, resolution) => {
    const state = useReaderStore.getState();
    const conflict = state.conflicts.find((c) => c.id === conflictId);
    if (!conflict || conflict.resolved) return null;

    const result: ConflictResolutionResult = {
      resolved: true,
      strategy: ConflictResolutionStrategy.Manual,
      winner: resolution,
      merged: resolution === 'local' ? conflict.localVersion : conflict.remoteVersion,
    };

    set((s) => ({
      conflicts: s.conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, resolved: true, resolution, resolvedAt: Date.now() }
          : c,
      ),
    }));

    return result;
  },
  clearConflicts: () => set({ conflicts: [] }),
  setProgress: (progress) => set({ progress }),
  addBookmark: (bookmark) => set((state) => ({ bookmarks: [bookmark, ...state.bookmarks] })),
  removeBookmark: (id) =>
    set((state) => ({ bookmarks: state.bookmarks.filter((b) => b.id !== id) })),
  setBookmarks: (bookmarks) => set({ bookmarks }),
  addHighlight: (highlight) => set((state) => ({ highlights: [highlight, ...state.highlights] })),
  removeHighlight: (id) =>
    set((state) => ({ highlights: state.highlights.filter((h) => h.id !== id) })),
  setHighlights: (highlights) => set({ highlights }),
  updateHighlight: (id, updates) =>
    set((state) => ({
      highlights: state.highlights.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    })),
  addComment: (comment) =>
    set((state) => {
      if (!comment.parentCommentId) {
        return { comments: [...state.comments, comment] };
      }

      const allComments = rebuildTree(state.comments, comment);
      return { comments: allComments };
    }),
  updateComment: (id, updates) =>
    set((state) => {
      const allComments = rebuildTree(state.comments, undefined, id, updates);
      return { comments: allComments };
    }),
  setComments: (comments) => set({ comments }),
  setCurrentChapter: (chapter) => set({ currentChapter: chapter }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setOffline: (offline) => set({ isOffline: offline }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setPermissionStatus: (status) => set({ permissionStatus: status }),
  setBookDirection: (direction) => set({ bookDirection: direction }),
  setBookWritingMode: (writingMode) => set({ bookWritingMode: writingMode }),
  setIsFixedLayout: (isFixedLayout) => set({ isFixedLayout }),
  setReaderSpread: (readerSpread) => set({ readerSpread }),
  setReaderZoom: (readerZoom) => set({ readerZoom }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  togglePanel: (panel) => set((state) => ({ activePanel: state.activePanel === panel ? null : panel })),
}));

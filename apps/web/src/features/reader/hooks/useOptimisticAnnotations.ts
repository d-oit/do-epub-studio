import { useOptimistic, useTransition, useCallback, useMemo, startTransition as startReactTransition } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useReaderStore } from '../../../stores';
import type { Highlight, Comment, Bookmark } from '../../../stores';

type OptimisticKind = 'highlight' | 'comment' | 'bookmark';

export type OptimisticAction =
  | { kind: 'add-highlight'; highlight: Highlight }
  | { kind: 'add-comment'; comment: Comment }
  | { kind: 'add-bookmark'; bookmark: Bookmark }
  | { kind: 'remove'; id: string; target: OptimisticKind };

export interface OptimisticState {
  highlights: Highlight[];
  comments: Comment[];
  bookmarks: Bookmark[];
}

function applyOptimistic(
  state: OptimisticState,
  action: OptimisticAction,
): OptimisticState {
  switch (action.kind) {
    case 'add-highlight':
      return { ...state, highlights: [action.highlight, ...state.highlights] };
    case 'add-comment':
      return { ...state, comments: [...state.comments, action.comment] };
    case 'add-bookmark':
      return { ...state, bookmarks: [action.bookmark, ...state.bookmarks] };
    case 'remove':
      if (action.target === 'highlight') {
        return { ...state, highlights: state.highlights.filter((h) => h.id !== action.id) };
      }
      if (action.target === 'comment') {
        return { ...state, comments: state.comments.filter((c) => c.id !== action.id) };
      }
      return { ...state, bookmarks: state.bookmarks.filter((b) => b.id !== action.id) };
    default:
      return state;
  }
}

export interface UseOptimisticAnnotationStore {
  state: OptimisticState;
  addOptimisticHighlight: (highlight: Highlight) => void;
  addOptimisticComment: (comment: Comment) => void;
  addOptimisticBookmark: (bookmark: Bookmark) => void;
  removeOptimistic: (id: string, target: OptimisticKind) => void;
  isPending: boolean;
}

/**
 * React 19 `useOptimistic` wrapper for the reader store's highlights,
 * comments, and bookmarks. The returned `state` reflects both committed
 * store values and any optimistic updates; once the underlying mutation
 * resolves (success or failure), the optimistic state is cleared and
 * the canonical store state is shown.
 *
 * If a mutation throws, the caller should `removeOptimistic` the temp
 * id so the placeholder is rolled back.
 */
export function useOptimisticAnnotationStore(): UseOptimisticAnnotationStore {
  const highlights = useReaderStore(useShallow((s) => s.highlights));
  const comments = useReaderStore(useShallow((s) => s.comments));
  const bookmarks = useReaderStore(useShallow((s) => s.bookmarks));

  const base: OptimisticState = useMemo(
    () => ({ highlights, comments, bookmarks }),
    [highlights, comments, bookmarks],
  );

  const [optimisticState, dispatchOptimistic] = useOptimistic<OptimisticState, OptimisticAction>(
    base,
    applyOptimistic,
  );

  const [isPending, startTransition] = useTransition();

  const addOptimisticHighlight = useCallback(
    (highlight: Highlight) => {
      startTransition(() => dispatchOptimistic({ kind: 'add-highlight', highlight }));
    },
    [dispatchOptimistic],
  );

  const addOptimisticComment = useCallback(
    (comment: Comment) => {
      startTransition(() => dispatchOptimistic({ kind: 'add-comment', comment }));
    },
    [dispatchOptimistic],
  );

  const addOptimisticBookmark = useCallback(
    (bookmark: Bookmark) => {
      startTransition(() => dispatchOptimistic({ kind: 'add-bookmark', bookmark }));
    },
    [dispatchOptimistic],
  );

  const removeOptimistic = useCallback(
    (id: string, target: OptimisticKind) => {
      startTransition(() => dispatchOptimistic({ kind: 'remove', id, target }));
    },
    [dispatchOptimistic],
  );

  return {
    state: optimisticState,
    addOptimisticHighlight,
    addOptimisticComment,
    addOptimisticBookmark,
    removeOptimistic,
    isPending,
  };
}

export { startReactTransition };

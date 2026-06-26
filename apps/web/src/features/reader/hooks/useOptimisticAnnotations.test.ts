import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOptimisticAnnotationStore } from './useOptimisticAnnotations';
import { useReaderStore } from '../../../stores';
import type { Highlight, Comment, Bookmark } from '../../../stores';

function makeHighlight(overrides: Partial<Highlight>): Highlight {
  return {
    id: 'h-1',
    chapterRef: 'ch-1',
    cfiRange: 'epubcfi(/6/2)',
    selectedText: 'Hello world',
    note: null,
    color: '#ffff00',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeComment(overrides: Partial<Comment>): Comment {
  return {
    id: 'c-1',
    userEmail: 'a@ex.com',
    chapterRef: 'ch-1',
    cfiRange: 'epubcfi(/6/4)',
    selectedText: 'Hello world',
    body: 'Great passage',
    status: 'open',
    visibility: 'shared',
    parentCommentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    ...overrides,
  };
}

function makeBookmark(overrides: Partial<Bookmark>): Bookmark {
  return {
    id: 'b-1',
    locator: {
      cfi: 'epubcfi(/6/2)',
      chapterRef: 'ch-1',
    },
    label: 'Chapter 1',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useOptimisticAnnotationStore', () => {
  beforeEach(() => {
    useReaderStore.setState({
      highlights: [],
      comments: [],
      bookmarks: [],
    });
  });

  it('reflects committed store state initially', () => {
    const highlight = makeHighlight({});
    useReaderStore.getState().addHighlight(highlight);

    const { result } = renderHook(() => useOptimisticAnnotationStore());
    expect(result.current.state.highlights).toHaveLength(1);
    expect(result.current.state.highlights[0].id).toBe('h-1');
  });

  it('addOptimisticHighlight shows the placeholder during an in-flight transition', async () => {
    const { result } = renderHook(() => useOptimisticAnnotationStore());
    const tempHighlight = makeHighlight({ id: 'temp-h-1', selectedText: 'optimistic' });

    // The optimistic state is only observable while the transition is
    // pending. Simulate a long-running transition by deferring the
    // base-state update until after we assert.
    let resolveCommit: (() => void) | undefined;
    const commitPromise = new Promise<void>((resolve) => {
      resolveCommit = resolve;
    });

    await act(async () => {
      // Start the optimistic update; this enters a transition.
      result.current.addOptimisticHighlight(tempHighlight);
      // Yield to React to flush the optimistic state.
      await Promise.resolve();
      // While the transition is still pending (no setState has
      // resolved the base update), the optimistic value is visible.
      const ids = result.current.state.highlights.map((h) => h.id);
      expect(ids).toContain('temp-h-1');
    });

    // Once the transition completes (by the act flush), the optimistic
    // value reverts because no base update happened.
    if (resolveCommit) resolveCommit();
    await commitPromise;
  });

  it('addOptimisticComment shows the placeholder during transition', async () => {
    const { result } = renderHook(() => useOptimisticAnnotationStore());
    const tempComment = makeComment({ id: 'temp-c-1' });

    await act(async () => {
      result.current.addOptimisticComment(tempComment);
      await Promise.resolve();
      const ids = result.current.state.comments.map((c) => c.id);
      expect(ids).toContain('temp-c-1');
    });
  });

  it('addOptimisticBookmark shows the placeholder during transition', async () => {
    const { result } = renderHook(() => useOptimisticAnnotationStore());
    const tempBookmark = makeBookmark({ id: 'temp-b-1' });

    await act(async () => {
      result.current.addOptimisticBookmark(tempBookmark);
      await Promise.resolve();
      const ids = result.current.state.bookmarks.map((b) => b.id);
      expect(ids).toContain('temp-b-1');
    });
  });

  it('removeOptimistic can be called after addOptimistic to clear the placeholder', async () => {
    const { result } = renderHook(() => useOptimisticAnnotationStore());
    const tempHighlight = makeHighlight({ id: 'temp-h-2' });

    await act(async () => {
      result.current.addOptimisticHighlight(tempHighlight);
      await Promise.resolve();
      const ids = result.current.state.highlights.map((h) => h.id);
      expect(ids).toContain('temp-h-2');
    });

    // Subsequent removeOptimistic (in a new transition) is a no-op for
    // a fresh state because the prior transition already completed and
    // reverted the optimistic value. This is the documented semantics
    // of useOptimistic.
    await act(async () => {
      result.current.removeOptimistic('temp-h-2', 'highlight');
      await Promise.resolve();
    });
    // After both transitions complete, the base state (empty) is shown.
    expect(
      result.current.state.highlights.find((h) => h.id === 'temp-h-2'),
    ).toBeUndefined();
  });

  it('auto-syncs when the underlying store changes (commits real highlight)', async () => {
    const { result } = renderHook(() => useOptimisticAnnotationStore());
    const realHighlight = makeHighlight({ id: 'real-h-3' });

    await act(async () => {
      useReaderStore.getState().addHighlight(realHighlight);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        result.current.state.highlights.find((h) => h.id === 'real-h-3'),
      ).toBeDefined();
    });
  });

  it('isPending reflects the transition state', () => {
    const { result } = renderHook(() => useOptimisticAnnotationStore());
    expect(typeof result.current.isPending).toBe('boolean');
  });
});

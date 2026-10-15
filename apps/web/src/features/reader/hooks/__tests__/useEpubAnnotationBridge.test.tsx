import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useEpubAnnotationBridge } from '../useEpubAnnotationBridge';

const mockAdapter = {
  scheduleRender: vi.fn(),
  clearAnnotations: vi.fn(),
  cancelScheduledRender: vi.fn(),
};

vi.mock('@do-epub-studio/reader-core', () => ({
  createEpubAnnotationAdapter: vi.fn(() => mockAdapter),
}));

const mockRendition = {
  on: vi.fn(),
};

describe('useEpubAnnotationBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('creates annotation adapter and schedules render on mount', () => {
    const highlightsRef = { current: [] };
    const commentsRef = { current: [] };
    const currentChapterRef = { current: 'ch1.xhtml' };
    const onNavigateToAnnotationRef = { current: vi.fn() };

    const { result, unmount } = renderHook(() =>
      useEpubAnnotationBridge({
        rendition: mockRendition as unknown as import('@intity/epub-js').Rendition,
        highlightsRef,
        commentsRef,
        currentChapterRef,
        onNavigateToAnnotationRef,
      }),
    );

    expect(result.current.adapterRef.current).toBe(mockAdapter);
    expect(mockAdapter.scheduleRender).toHaveBeenCalledWith(
      'ch1.xhtml',
      [],
      [],
      expect.any(Function),
    );
    expect(mockRendition.on).toHaveBeenCalledWith('displayed', expect.any(Function));

    unmount();

    expect(mockAdapter.clearAnnotations).toHaveBeenCalled();
    expect(mockAdapter.cancelScheduledRender).toHaveBeenCalled();
  });
});

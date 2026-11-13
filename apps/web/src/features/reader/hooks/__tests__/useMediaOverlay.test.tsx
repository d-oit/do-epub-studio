import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import type { Book } from '@intity/epub-js';
import { useMediaOverlay } from '../useMediaOverlay';
import type * as readerCore from '@do-epub-studio/reader-core';
import * as mediaOverlayMod from '@do-epub-studio/reader-core/media-overlay';

vi.mock('@do-epub-studio/reader-core/media-overlay', async () => {
  const actual = await vi.importActual<typeof mediaOverlayMod>(
    '@do-epub-studio/reader-core/media-overlay',
  );
  return {
    ...actual,
    extractMediaOverlays: vi.fn(),
    resolveAudioClipUrl: vi.fn(),
  };
});

describe('useMediaOverlay hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('initializes with default empty state when book has no media overlays', async () => {
    vi.mocked(mediaOverlayMod.extractMediaOverlays).mockResolvedValue({
      sequencesByChapter: {},
      totalDuration: 0,
      hasMediaOverlays: false,
    });

    const { result, unmount } = renderHook(() =>
      useMediaOverlay({
        book: {} as unknown as Book,
        rendition: null,
        currentChapter: 'chapter.xhtml',
      }),
    );

    await waitFor(() => {
      expect(result.current.hasMediaOverlays).toBe(false);
    });
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.duration).toBe(0);
    unmount();
  });

  it('detects media overlays and populates active sequence', async () => {
    const mockSequence: readerCore.MediaOverlaySequence = {
      id: 'seq1',
      textRef: 'OEBPS/chapter.xhtml',
      smilPath: 'OEBPS/overlay.smil',
      totalDuration: 5,
      clips: [
        {
          id: 'c1',
          textHref: 'OEBPS/chapter.xhtml#p1',
          elementId: 'p1',
          audioSrc: 'OEBPS/audio.mp3',
          clipBegin: 0,
          clipEnd: 5,
          duration: 5,
        },
      ],
    };

    vi.mocked(mediaOverlayMod.extractMediaOverlays).mockResolvedValue({
      sequencesByChapter: {
        'OEBPS/chapter.xhtml': mockSequence,
        'chapter.xhtml': mockSequence,
      },
      totalDuration: 5,
      hasMediaOverlays: true,
    });

    const { result, unmount } = renderHook(() =>
      useMediaOverlay({
        book: {} as unknown as Book,
        rendition: null,
        currentChapter: 'chapter.xhtml',
      }),
    );

    await waitFor(() => {
      expect(result.current.hasMediaOverlays).toBe(true);
    });

    expect(result.current.duration).toBe(5);
    expect(result.current.activeSequence?.id).toBe('seq1');
    unmount();
  });

  it('updates playback rate when setPlaybackRate is called', () => {
    const { result, unmount } = renderHook(() =>
      useMediaOverlay({
        book: null,
        rendition: null,
        currentChapter: null,
      }),
    );

    act(() => {
      result.current.setPlaybackRate(1.5);
    });

    expect(result.current.playbackRate).toBe(1.5);
    unmount();
  });

  it('seeks to target time bounded by duration', async () => {
    const mockSequence: readerCore.MediaOverlaySequence = {
      id: 'seq1',
      smilPath: 'overlay.smil',
      totalDuration: 10,
      clips: [
        {
          id: 'c1',
          textHref: 'c.xhtml#p1',
          elementId: 'p1',
          audioSrc: 'a.mp3',
          clipBegin: 0,
          clipEnd: 5,
          duration: 5,
        },
        {
          id: 'c2',
          textHref: 'c.xhtml#p2',
          elementId: 'p2',
          audioSrc: 'a.mp3',
          clipBegin: 5,
          clipEnd: 10,
          duration: 5,
        },
      ],
    };

    vi.mocked(mediaOverlayMod.extractMediaOverlays).mockResolvedValue({
      sequencesByChapter: { 'c.xhtml': mockSequence },
      totalDuration: 10,
      hasMediaOverlays: true,
    });

    const { result, unmount } = renderHook(() =>
      useMediaOverlay({
        book: {} as unknown as Book,
        rendition: null,
        currentChapter: 'c.xhtml',
      }),
    );

    await waitFor(() => {
      expect(result.current.hasMediaOverlays).toBe(true);
    });

    act(() => {
      result.current.seek(7);
    });

    expect(result.current.currentTime).toBe(7);
    expect(result.current.activeClip?.id).toBe('c2');
    unmount();
  });
});

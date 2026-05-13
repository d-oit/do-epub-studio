/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  renderHighlightsOnRendition,
  renderCommentMarkersOnRendition,
  type HighlightRecord,
  type CommentRecord,
} from '../features/reader/annotationRendering';
import type { Rendition } from '@intity/epub-js';

interface AnnotationData {
  type: string;
  cfiRange: string;
  data?: unknown;
  cb?: () => void;
  styles?: Record<string, string>;
}

interface AnnotationsMock {
  append: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  _set: (key: string, value: AnnotationData) => void;
  [Symbol.iterator](): Iterator<[string, AnnotationData]>;
}

// Minimal mock of the epubjs Annotations API
function makeAnnotationsMock(): AnnotationsMock {
  const annotations = new Map<string, AnnotationData>();
  return {
    append: vi.fn((type: string, cfi: string, { data, cb, styles }: Record<string, unknown>) => {
      annotations.set(`${type}-${cfi}`, { type, cfiRange: cfi, data, cb: cb as (() => void) | undefined, styles: styles as Record<string, string> | undefined });
    }),
    remove: vi.fn((cfi: string, type: string) => {
      annotations.delete(`${type}-${cfi}`);
    }),
    // Mock for iteration
    [Symbol.iterator]: function* () {
      yield* annotations.entries();
    },
    // Adding Map-like methods if needed for the test to set up state
    _set: (key: string, value: AnnotationData) => annotations.set(key, value),
  };
}

function makeRenditionMock() {
  const annotations = makeAnnotationsMock();
  return {
    annotations,
  } as unknown as Rendition;
}

// ─── renderHighlightsOnRendition ─────────────────────────────────────────────

describe('renderHighlightsOnRendition', () => {
  let rendition: Rendition;

  beforeEach(() => {
    rendition = makeRenditionMock();
  });

  it('clears existing highlight annotations before rendering', () => {
    const existingAnnotation = { type: 'highlight', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)' };
    (rendition.annotations as unknown as AnnotationsMock)._set('highlight-epubcfi(/6/4!/4/2/1:0,/1:10)', existingAnnotation);

    renderHighlightsOnRendition(rendition, 'chapter1.html', []);

    expect(rendition.annotations.remove).toHaveBeenCalledWith(existingAnnotation.cfiRange, 'highlight');
  });

  it('does not call append() when chapterHref is null', () => {
    const highlights: HighlightRecord[] = [
      { id: 'h1', chapterRef: 'chapter1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', color: '#ffff00' },
    ];

    renderHighlightsOnRendition(rendition, null, highlights);

    expect(rendition.annotations.append).not.toHaveBeenCalled();
  });

  it('renders only highlights matching the current chapter', () => {
    const highlights: HighlightRecord[] = [
      { id: 'h1', chapterRef: 'chapter1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', color: '#ffff00' },
      { id: 'h2', chapterRef: 'chapter2.html', cfiRange: 'epubcfi(/6/6!/4/2/1:0,/1:5)', color: '#ff0000' },
    ];

    renderHighlightsOnRendition(rendition, 'chapter1.html', highlights);

    expect(rendition.annotations.append).toHaveBeenCalledTimes(1);
    expect(rendition.annotations.append).toHaveBeenCalledWith(
      'highlight',
      'epubcfi(/6/4!/4/2/1:0,/1:10)',
      {
        data: highlights[0],
        styles: { fill: '#ffff00', 'fill-opacity': '0.3' },
      },
    );
  });

  it('skips highlights with no cfiRange', () => {
    const highlights: HighlightRecord[] = [
      { id: 'h1', chapterRef: 'chapter1.html', cfiRange: null, color: '#ffff00' },
    ];

    renderHighlightsOnRendition(rendition, 'chapter1.html', highlights);

    expect(rendition.annotations.append).not.toHaveBeenCalled();
  });

  it('renders multiple highlights for the same chapter', () => {
    const highlights: HighlightRecord[] = [
      { id: 'h1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:5)', color: '#ffff00' },
      { id: 'h2', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:6,/1:12)', color: '#00ff00' },
    ];

    renderHighlightsOnRendition(rendition, 'ch1.html', highlights);

    expect(rendition.annotations.append).toHaveBeenCalledTimes(2);
  });
});

describe('renderCommentMarkersOnRendition', () => {
  let rendition: Rendition;
  const onNavigate = vi.fn();

  beforeEach(() => {
    rendition = makeRenditionMock();
    onNavigate.mockClear();
  });

  it('clears existing underline annotations before rendering', () => {
    const existingAnnotation = { type: 'underline', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)' };
    (rendition.annotations as unknown as AnnotationsMock)._set('underline-epubcfi(/6/4!/4/2/1:0,/1:10)', existingAnnotation);

    renderCommentMarkersOnRendition(rendition, 'chapter1.html', [], onNavigate);

    expect(rendition.annotations.remove).toHaveBeenCalledWith(existingAnnotation.cfiRange, 'underline');
  });

  it('does not call append() when chapterHref is null', () => {
    const comments: CommentRecord[] = [
      { id: 'c1', chapterRef: 'chapter1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'open' },
    ];

    renderCommentMarkersOnRendition(rendition, null, comments, onNavigate);

    expect(rendition.annotations.append).not.toHaveBeenCalled();
  });

  it('skips deleted comments', () => {
    const comments: CommentRecord[] = [
      { id: 'c1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'deleted' },
    ];

    renderCommentMarkersOnRendition(rendition, 'ch1.html', comments, onNavigate);

    expect(rendition.annotations.append).not.toHaveBeenCalled();
  });

  it('renders only comments matching the current chapter', () => {
    const comments: CommentRecord[] = [
      { id: 'c1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'open' },
      { id: 'c2', chapterRef: 'ch2.html', cfiRange: 'epubcfi(/6/6!/4/2/1:0,/1:5)', status: 'open' },
    ];

    renderCommentMarkersOnRendition(rendition, 'ch1.html', comments, onNavigate);

    expect(rendition.annotations.append).toHaveBeenCalledTimes(1);
    expect(rendition.annotations.append).toHaveBeenCalledWith(
      'underline',
      'epubcfi(/6/4!/4/2/1:0,/1:10)',
      {
        data: comments[0],
        cb: expect.any(Function),
        styles: { stroke: '#3b82f6', 'stroke-width': '2px', 'stroke-opacity': '0.7' },
      },
    );
  });

  it('uses muted styles for resolved comments', () => {
    const comments: CommentRecord[] = [
      { id: 'c1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'resolved' },
    ];

    renderCommentMarkersOnRendition(rendition, 'ch1.html', comments, onNavigate);

    expect(rendition.annotations.append).toHaveBeenCalledWith(
      'underline',
      expect.any(String),
      expect.objectContaining({
        styles: { stroke: '#9ca3af', 'stroke-width': '1px', 'stroke-opacity': '0.4' },
      }),
    );
  });

  it('click callback invokes onNavigate with chapterRef and cfiRange', () => {
    const comments: CommentRecord[] = [
      { id: 'c1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'open' },
    ];

    renderCommentMarkersOnRendition(rendition, 'ch1.html', comments, onNavigate);

    const [, , options] = vi.mocked(rendition.annotations.append).mock.calls[0];
    (options as { cb?: () => void }).cb?.();

    expect(onNavigate).toHaveBeenCalledWith('ch1.html', 'epubcfi(/6/4!/4/2/1:0,/1:10)');
  });
});

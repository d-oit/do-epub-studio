/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  renderHighlightsOnRendition,
  renderCommentMarkersOnRendition,
  type HighlightRecord,
  type CommentRecord,
} from '../features/reader/annotationRendering';
import type { Rendition } from 'epubjs';

// Minimal mock of the epubjs Annotations API
function makeAnnotationsMock() {
  return {
    highlight: vi.fn(),
    underline: vi.fn(),
    remove: vi.fn(),
    each: vi.fn().mockReturnValue([]),
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
    const existingAnnotation = { cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)' };
    vi.mocked(rendition.annotations.each).mockReturnValue([existingAnnotation] as never);

    renderHighlightsOnRendition(rendition, 'chapter1.html', []);

    expect(rendition.annotations.remove).toHaveBeenCalledWith(existingAnnotation.cfiRange, 'highlight');
  });

  it('does not call highlight() when chapterHref is null', () => {
    const highlights: HighlightRecord[] = [
      { id: 'h1', chapterRef: 'chapter1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', color: '#ffff00' },
    ];

    renderHighlightsOnRendition(rendition, null, highlights);

    expect(rendition.annotations.highlight).not.toHaveBeenCalled();
  });

  it('renders only highlights matching the current chapter', () => {
    const highlights: HighlightRecord[] = [
      { id: 'h1', chapterRef: 'chapter1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', color: '#ffff00' },
      { id: 'h2', chapterRef: 'chapter2.html', cfiRange: 'epubcfi(/6/6!/4/2/1:0,/1:5)', color: '#ff0000' },
    ];

    renderHighlightsOnRendition(rendition, 'chapter1.html', highlights);

    expect(rendition.annotations.highlight).toHaveBeenCalledTimes(1);
    expect(rendition.annotations.highlight).toHaveBeenCalledWith(
      'epubcfi(/6/4!/4/2/1:0,/1:10)',
      { id: 'h1', data: highlights[0] },
      undefined,
      undefined,
      { fill: '#ffff00', 'fill-opacity': '0.3' },
    );
  });

  it('skips highlights with no cfiRange', () => {
    const highlights: HighlightRecord[] = [
      { id: 'h1', chapterRef: 'chapter1.html', cfiRange: null, color: '#ffff00' },
    ];

    renderHighlightsOnRendition(rendition, 'chapter1.html', highlights);

    expect(rendition.annotations.highlight).not.toHaveBeenCalled();
  });

  it('renders multiple highlights for the same chapter', () => {
    const highlights: HighlightRecord[] = [
      { id: 'h1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:5)', color: '#ffff00' },
      { id: 'h2', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:6,/1:12)', color: '#00ff00' },
    ];

    renderHighlightsOnRendition(rendition, 'ch1.html', highlights);

    expect(rendition.annotations.highlight).toHaveBeenCalledTimes(2);
  });
});

// ─── renderCommentMarkersOnRendition ─────────────────────────────────────────

describe('renderCommentMarkersOnRendition', () => {
  let rendition: Rendition;
  const onNavigate = vi.fn();

  beforeEach(() => {
    rendition = makeRenditionMock();
    onNavigate.mockClear();
  });

  it('clears existing underline annotations before rendering', () => {
    const existingAnnotation = { cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)' };
    vi.mocked(rendition.annotations.each).mockReturnValue([existingAnnotation] as never);

    renderCommentMarkersOnRendition(rendition, 'chapter1.html', [], onNavigate);

    expect(rendition.annotations.remove).toHaveBeenCalledWith(existingAnnotation.cfiRange, 'underline');
  });

  it('does not call underline() when chapterHref is null', () => {
    const comments: CommentRecord[] = [
      { id: 'c1', chapterRef: 'chapter1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'open' },
    ];

    renderCommentMarkersOnRendition(rendition, null, comments, onNavigate);

    expect(rendition.annotations.underline).not.toHaveBeenCalled();
  });

  it('skips deleted comments', () => {
    const comments: CommentRecord[] = [
      { id: 'c1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'deleted' },
    ];

    renderCommentMarkersOnRendition(rendition, 'ch1.html', comments, onNavigate);

    expect(rendition.annotations.underline).not.toHaveBeenCalled();
  });

  it('renders only comments matching the current chapter', () => {
    const comments: CommentRecord[] = [
      { id: 'c1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'open' },
      { id: 'c2', chapterRef: 'ch2.html', cfiRange: 'epubcfi(/6/6!/4/2/1:0,/1:5)', status: 'open' },
    ];

    renderCommentMarkersOnRendition(rendition, 'ch1.html', comments, onNavigate);

    expect(rendition.annotations.underline).toHaveBeenCalledTimes(1);
    expect(rendition.annotations.underline).toHaveBeenCalledWith(
      'epubcfi(/6/4!/4/2/1:0,/1:10)',
      { id: 'c1', data: comments[0] },
      expect.any(Function),
      undefined,
      { stroke: '#3b82f6', 'stroke-width': '2px', 'stroke-opacity': '0.7' },
    );
  });

  it('uses muted styles for resolved comments', () => {
    const comments: CommentRecord[] = [
      { id: 'c1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'resolved' },
    ];

    renderCommentMarkersOnRendition(rendition, 'ch1.html', comments, onNavigate);

    expect(rendition.annotations.underline).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
      undefined,
      { stroke: '#9ca3af', 'stroke-width': '1px', 'stroke-opacity': '0.4' },
    );
  });

  it('click callback invokes onNavigate with chapterRef and cfiRange', () => {
    const comments: CommentRecord[] = [
      { id: 'c1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'open' },
    ];

    renderCommentMarkersOnRendition(rendition, 'ch1.html', comments, onNavigate);

    // Extract and invoke the click callback passed to underline()
    const [, , clickCb] = vi.mocked(rendition.annotations.underline).mock.calls[0];
    (clickCb as () => void)();

    expect(onNavigate).toHaveBeenCalledWith('ch1.html', 'epubcfi(/6/4!/4/2/1:0,/1:10)');
  });

  it('uses typed underline() — not annotations.add() — so no any cast is needed', () => {
    // Verify the function calls the typed API, not a raw .add() workaround.
    // If this test compiles and passes, the any-cast suppression is gone.
    const comments: CommentRecord[] = [
      { id: 'c1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'open' },
    ];

    renderCommentMarkersOnRendition(rendition, 'ch1.html', comments, onNavigate);

    expect(rendition.annotations.underline).toHaveBeenCalled();
    // annotations.add should never be called directly
    expect((rendition.annotations as { add?: unknown }).add).toBeUndefined();
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createEpubAnnotationAdapter,
  type HighlightRecord,
  type CommentRecord,
} from '../annotation-adapter';
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

function makeAnnotationsMock(): AnnotationsMock {
  const annotations = new Map<string, AnnotationData>();
  return {
    append: vi.fn((_type: string, _cfi: string, _opts: Record<string, unknown>) => {
      annotations.set(`${_type}-${_cfi}`, {
        type: _type,
        cfiRange: _cfi,
        data: _opts?.data,
        cb: _opts?.cb as (() => void) | undefined,
        styles: _opts?.styles as Record<string, string> | undefined,
      });
    }),
    remove: vi.fn((_cfi: string, _type: string) => {
      annotations.delete(`${_type}-${_cfi}`);
    }),
    [Symbol.iterator]: function* () {
      yield* annotations.entries();
    },
    _set: (key: string, value: AnnotationData) => annotations.set(key, value),
  };
}

function makeRenditionMock() {
  const annotations = makeAnnotationsMock();
  return { annotations } as unknown as Rendition;
}

describe('createEpubAnnotationAdapter', () => {
  let rendition: Rendition;
  let adapter: ReturnType<typeof createEpubAnnotationAdapter>;

  beforeEach(() => {
    rendition = makeRenditionMock();
    adapter = createEpubAnnotationAdapter(rendition);
  });

  describe('renderHighlights', () => {
    it('clears existing highlight annotations before rendering', () => {
      const mock = rendition.annotations as unknown as AnnotationsMock;
      mock._set(
        'highlight-epubcfi(/6/4!/4/2/1:0,/1:10)',
        { type: 'highlight', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)' },
      );

      adapter.renderHighlights('chapter1.html', []);

      expect(mock.remove).toHaveBeenCalledWith('epubcfi(/6/4!/4/2/1:0,/1:10)', 'highlight');
    });

    it('does not append when chapterHref is null', () => {
      const highlights: HighlightRecord[] = [
        { id: 'h1', chapterRef: 'chapter1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', color: '#ffff00' },
      ];

      adapter.renderHighlights(null, highlights);

      const mock = rendition.annotations as unknown as AnnotationsMock;
      expect(mock.append).not.toHaveBeenCalled();
    });

    it('renders only highlights matching the current chapter', () => {
      const highlights: HighlightRecord[] = [
        { id: 'h1', chapterRef: 'chapter1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', color: '#ffff00' },
        { id: 'h2', chapterRef: 'chapter2.html', cfiRange: 'epubcfi(/6/6!/4/2/1:0,/1:5)', color: '#ff0000' },
      ];

      adapter.renderHighlights('chapter1.html', highlights);

      const mock = rendition.annotations as unknown as AnnotationsMock;
      expect(mock.append).toHaveBeenCalledTimes(1);
      expect(mock.append).toHaveBeenCalledWith(
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

      adapter.renderHighlights('chapter1.html', highlights);

      const mock = rendition.annotations as unknown as AnnotationsMock;
      expect(mock.append).not.toHaveBeenCalled();
    });

    it('renders multiple highlights for the same chapter', () => {
      const highlights: HighlightRecord[] = [
        { id: 'h1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:5)', color: '#ffff00' },
        { id: 'h2', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:6,/1:12)', color: '#00ff00' },
      ];

      adapter.renderHighlights('ch1.html', highlights);

      const mock = rendition.annotations as unknown as AnnotationsMock;
      expect(mock.append).toHaveBeenCalledTimes(2);
    });
  });

  describe('renderCommentMarkers', () => {
    const onNavigate = vi.fn();

    beforeEach(() => {
      onNavigate.mockClear();
    });

    it('clears existing underline annotations before rendering', () => {
      const mock = rendition.annotations as unknown as AnnotationsMock;
      mock._set(
        'underline-epubcfi(/6/4!/4/2/1:0,/1:10)',
        { type: 'underline', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)' },
      );

      adapter.renderCommentMarkers('chapter1.html', [], onNavigate);

      expect(mock.remove).toHaveBeenCalledWith('epubcfi(/6/4!/4/2/1:0,/1:10)', 'underline');
    });

    it('does not append when chapterHref is null', () => {
      const comments: CommentRecord[] = [
        { id: 'c1', chapterRef: 'chapter1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'open' },
      ];

      adapter.renderCommentMarkers(null, comments, onNavigate);

      const mock = rendition.annotations as unknown as AnnotationsMock;
      expect(mock.append).not.toHaveBeenCalled();
    });

    it('skips deleted comments', () => {
      const comments: CommentRecord[] = [
        { id: 'c1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'deleted' },
      ];

      adapter.renderCommentMarkers('ch1.html', comments, onNavigate);

      const mock = rendition.annotations as unknown as AnnotationsMock;
      expect(mock.append).not.toHaveBeenCalled();
    });

    it('renders only comments matching the current chapter', () => {
      const comments: CommentRecord[] = [
        { id: 'c1', chapterRef: 'ch1.html', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)', status: 'open' },
        { id: 'c2', chapterRef: 'ch2.html', cfiRange: 'epubcfi(/6/6!/4/2/1:0,/1:5)', status: 'open' },
      ];

      adapter.renderCommentMarkers('ch1.html', comments, onNavigate);

      const mock = rendition.annotations as unknown as AnnotationsMock;
      expect(mock.append).toHaveBeenCalledTimes(1);
      expect(mock.append).toHaveBeenCalledWith(
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

      adapter.renderCommentMarkers('ch1.html', comments, onNavigate);

      const mock = rendition.annotations as unknown as AnnotationsMock;
      expect(mock.append).toHaveBeenCalledWith(
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

      adapter.renderCommentMarkers('ch1.html', comments, onNavigate);

      const mock = rendition.annotations as unknown as AnnotationsMock;
      const calls = vi.mocked(mock.append).mock.calls;
      const options = calls?.[0]?.[2] as { cb?: () => void } | undefined;
      options?.cb?.();

      expect(onNavigate).toHaveBeenCalledWith('ch1.html', 'epubcfi(/6/4!/4/2/1:0,/1:10)');
    });
  });

  describe('clearAnnotations', () => {
    it('removes all annotations', () => {
      const mock = rendition.annotations as unknown as AnnotationsMock;
      mock._set(
        'highlight-epubcfi(/6/4!/4/2/1:0,/1:10)',
        { type: 'highlight', cfiRange: 'epubcfi(/6/4!/4/2/1:0,/1:10)' },
      );
      mock._set(
        'underline-epubcfi(/6/4!/4/2/1:6,/1:12)',
        { type: 'underline', cfiRange: 'epubcfi(/6/4!/4/2/1:6,/1:12)' },
      );

      adapter.clearAnnotations();

      expect(mock.remove).toHaveBeenCalledTimes(2);
    });
  });
});

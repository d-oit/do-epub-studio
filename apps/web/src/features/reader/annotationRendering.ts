/**
 * Pure helpers for rendering EPUB annotation overlays (highlights and comment
 * underlines) onto an epubjs Rendition. Extracted from ReaderPage so they can
 * be unit-tested without a React environment.
 */
import type { Rendition } from '@intity/epub-js';

export interface HighlightRecord {
  id: string;
  chapterRef?: string | null;
  cfiRange?: string | null;
  color: string;
}

export interface CommentRecord {
  id: string;
  chapterRef?: string | null;
  cfiRange?: string | null;
  status: string;
}

/**
 * Re-render all highlight annotations for the given chapter onto `rendition`.
 * Clears existing highlights first to avoid duplicates on chapter navigation.
 */
interface InternalAnnotation {
  type: string;
  cfiRange: string;
}

export function renderHighlightsOnRendition(
  rendition: Rendition,
  chapterHref: string | null,
  highlights: HighlightRecord[],
): void {
  const existing = rendition.annotations as unknown as Map<string, InternalAnnotation>;
  for (const [, annotation] of existing) {
    if (annotation.type === 'highlight') {
      rendition.annotations.remove(annotation.cfiRange, 'highlight');
    }
  }

  if (!chapterHref) return;

  const chapterHighlights = highlights.filter(
    (h) => h.chapterRef === chapterHref && h.cfiRange,
  );

  for (const highlight of chapterHighlights) {
    rendition.annotations.append('highlight', highlight.cfiRange as string, {
      data: highlight,
      styles: { fill: highlight.color, 'fill-opacity': '0.3' },
    });
  }
}

/**
 * Re-render all comment underline annotations for the given chapter onto
 * `rendition`. Clears existing underlines first. Deleted comments are skipped.
 * `onNavigate` is called when the user clicks an underline.
 */
export function renderCommentMarkersOnRendition(
  rendition: Rendition,
  chapterHref: string | null,
  comments: CommentRecord[],
  onNavigate: (chapterRef: string, cfiRange?: string) => void,
): void {
  const existing = rendition.annotations as unknown as Map<string, InternalAnnotation>;
  for (const [, annotation] of existing) {
    if (annotation.type === 'underline') {
      rendition.annotations.remove(annotation.cfiRange, 'underline');
    }
  }

  if (!chapterHref) return;

  const chapterComments = comments.filter(
    (c) => c.chapterRef === chapterHref && c.cfiRange && c.status !== 'deleted',
  );

  for (const comment of chapterComments) {
    const isResolved = comment.status === 'resolved';
    rendition.annotations.append('underline', comment.cfiRange as string, {
      data: comment,
      cb: () => {
        onNavigate(comment.chapterRef ?? '', comment.cfiRange ?? undefined);
      },
      styles: {
        stroke: isResolved ? '#9ca3af' : '#3b82f6',
        'stroke-width': isResolved ? '1px' : '2px',
        'stroke-opacity': isResolved ? '0.4' : '0.7',
      },
    });
  }
}

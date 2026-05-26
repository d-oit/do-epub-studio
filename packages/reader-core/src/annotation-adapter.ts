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

export interface AnnotationAdapter {
  renderHighlights(chapterHref: string | null, highlights: HighlightRecord[]): void;
  renderCommentMarkers(
    chapterHref: string | null,
    comments: CommentRecord[],
    onNavigate: (chapterRef: string, cfiRange?: string) => void,
  ): void;
  clearAnnotations(): void;
}

interface InternalAnnotation {
  type: string;
  cfiRange: string;
}

interface AnnotationsIterable {
  [Symbol.iterator](): Iterator<[string, InternalAnnotation]>;
}

export function createEpubAnnotationAdapter(rendition: Rendition): AnnotationAdapter {
  function removeAnnotationsByType(type: string): void {
    const existing = rendition.annotations as unknown as AnnotationsIterable;
    for (const [, annotation] of existing) {
      if (annotation.type === type) {
        rendition.annotations.remove(annotation.cfiRange, type);
      }
    }
  }

  return {
    renderHighlights(chapterHref, highlights) {
      removeAnnotationsByType('highlight');

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
    },

    renderCommentMarkers(chapterHref, comments, onNavigate) {
      removeAnnotationsByType('underline');

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
    },

    clearAnnotations() {
      const existing = rendition.annotations as unknown as AnnotationsIterable;
      const toRemove: Array<{ cfiRange: string; type: string }> = [];
      for (const [, annotation] of existing) {
        toRemove.push({ cfiRange: annotation.cfiRange, type: annotation.type });
      }
      for (const { cfiRange, type } of toRemove) {
        rendition.annotations.remove(cfiRange, type);
      }
    },
  };
}

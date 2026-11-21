import {
  PORTABILITY_FORMAT,
  PORTABILITY_PROFILE,
  PORTABILITY_VERSION,
  PortabilityEnvelopeSchema,
  type PortabilityEnvelope,
  type PortabilityPublicationItem,
  type PortabilityProgress,
} from '@do-epub-studio/schema';
import { buildAnnotationInterchange } from '../../features/reader/lib/annotation-interchange';
import type { Bookmark, Comment, Highlight } from '../../stores/reader';
import { APP_VERSION_LABEL } from '../../config/app-identity';
export const EXT_NS = 'https://do-epub-studio.org/extensions/v1';

export interface PublicationExportSource {
  bookId: string;
  slug: string;
  title: string;
  highlights: Highlight[];
  bookmarks: Bookmark[];
  comments: Comment[];
  progress: PortabilityProgress | null;
}

export interface PortabilityBuildOptions {
  scope: 'book' | 'account';
  exportedAt?: string;
  /** Publications to include. For `book` scope pass exactly one, for `account` all. */
  publications: PublicationExportSource[];
  /** Reader preferences to include (account scope). */
  preferences?: {
    theme: string;
    fontFamily: string;
    fontSize: string;
    lineHeight: number;
    pageWidth: string;
    direction: string;
    writingMode: string;
    aiEnabled: boolean;
  };
}


/**
 * Confirm a single publication identity losslessly (including internal anchor
 * bookkeeping) as an EPUB Annotations document. The `extensionsFor` callback
 * receives the source record kind and id and returns HTTPS-namespaced JSON
 * keys; those keys are preserved verbatim through round-trips.
 */
function buildPublicationDocument(source: PublicationExportSource) {
  return buildAnnotationInterchange({
    bookId: source.bookId,
    bookTitle: source.title,
    state: {
      highlights: source.highlights,
      bookmarks: source.bookmarks,
      comments: source.comments,
    },
    extensionsFor: (item) => {
      if (item.kind === 'highlight') {
        const highlight = source.highlights.find((h) => h.id === item.id);
        if (!highlight) return undefined;
        return {
          [`${EXT_NS}/highlight/color`]: highlight.color,
          [`${EXT_NS}/highlight/anchorStatus`]: highlight.anchorStatus ?? 'anchored',
          [`${EXT_NS}/highlight/confidence`]: highlight.confidence ?? 1.0,
          [`${EXT_NS}/highlight/migrationOutcome`]: highlight.migrationOutcome ?? null,
          [`${EXT_NS}/highlight/revisionId`]: highlight.revisionId ?? null,
          [`${EXT_NS}/highlight/originalCfi`]: highlight.originalCfi ?? null,
          [`${EXT_NS}/highlight/originalChapterRef`]: highlight.originalChapterRef ?? null,
          [`${EXT_NS}/highlight/originalSelectedText`]: highlight.originalSelectedText ?? null,
        };
      }
      if (item.kind === 'comment') {
        const comment = source.comments.find((c) => c.id === item.id);
        if (!comment) return undefined;
        return {
          [`${EXT_NS}/comment/status`]: comment.status,
          [`${EXT_NS}/comment/visibility`]: comment.visibility,
          [`${EXT_NS}/comment/resolvedAt`]: comment.resolvedAt ?? null,
          [`${EXT_NS}/comment/parentCommentId`]: comment.parentCommentId ?? null,
          [`${EXT_NS}/comment/anchorStatus`]: comment.anchorStatus ?? 'anchored',
          [`${EXT_NS}/comment/confidence`]: comment.confidence ?? 1.0,
          [`${EXT_NS}/comment/migrationOutcome`]: comment.migrationOutcome ?? null,
          [`${EXT_NS}/comment/revisionId`]: comment.revisionId ?? null,
          [`${EXT_NS}/comment/originalCfi`]: comment.originalCfi ?? null,
          [`${EXT_NS}/comment/originalChapterRef`]: comment.originalChapterRef ?? null,
          [`${EXT_NS}/comment/originalSelectedText`]: comment.originalSelectedText ?? null,
        };
      }
      return undefined;
    },
  });
}

/**
 * Deterministic envelope builder. Items are sorted by book id, and each
 * publication's annotation items are sorted by annotation id, so identical
 * input bytes produce byte-identical archives (JSON key order is stable).
 */
export function buildPortabilityEnvelope(options: PortabilityBuildOptions): PortabilityEnvelope {
  const publications = [...options.publications].sort((a, b) =>
    a.bookId.localeCompare(b.bookId),
  );

  const items: PortabilityEnvelope['items'] = publications.map((source) => {
    const hasLocator = (h: Highlight) => Boolean(h.cfiRange && h.chapterRef && h.selectedText);
    const completeState = {
      highlights: source.highlights.filter(hasLocator),
      bookmarks: source.bookmarks.filter(
        (b) => Boolean(b.locator.cfi && b.locator.chapterRef && b.locator.selectedText),
      ),
      comments: source.comments.filter(
        (c) => Boolean(c.cfiRange && c.chapterRef && c.selectedText),
      ),
    };
    const document = buildPublicationDocument({ ...source, ...completeState });
    const sortedItems = [...document.items].sort((a, b) => a.id.localeCompare(b.id));

    const orphanHighlights = source.highlights.filter((h) => !hasLocator(h));
    const orphanBookmarks = source.bookmarks.filter(
      (b) => !(b.locator.cfi && b.locator.chapterRef && b.locator.selectedText),
    );
    const orphanComments = source.comments.filter(
      (c) => !(c.cfiRange && c.chapterRef && c.selectedText),
    );
    const publication: PortabilityPublicationItem = {
      type: 'publication',
      id: crypto.randomUUID(),
      bookId: source.bookId,
      slug: source.slug,
      title: source.title,
      annotations: { ...document, items: sortedItems },
      progress: source.progress,
    };
    if (orphanHighlights.length > 0 || orphanBookmarks.length > 0 || orphanComments.length > 0) {
      publication.orphans = {
        highlights: orphanHighlights.map((h) => ({
          id: h.id,
          note: h.note,
          color: h.color,
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
        })),
        bookmarks: orphanBookmarks.map((b) => ({
          id: b.id,
          label: b.label,
          createdAt: b.createdAt,
        })),
        comments: orphanComments.map((c) => ({
          id: c.id,
          body: c.body,
          status: c.status,
          visibility: c.visibility,
          parentCommentId: c.parentCommentId,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          resolvedAt: c.resolvedAt,
        })),
      };
    }
    return publication;
  });

  if (options.preferences) {
    items.push({
      type: 'preferences',
      id: crypto.randomUUID(),
      preferences: {
        theme: options.preferences.theme as 'light' | 'dark' | 'sepia' | 'system',
        fontFamily: options.preferences.fontFamily as 'serif' | 'sans-serif' | 'monospace',
        fontSize: options.preferences.fontSize as 'small' | 'medium' | 'large' | 'xlarge',
        lineHeight: options.preferences.lineHeight as 1 | 2 | 3,
        pageWidth: options.preferences.pageWidth as 'narrow' | 'normal' | 'wide' | 'full',
        direction: options.preferences.direction as 'default' | 'ltr' | 'rtl',
        writingMode: options.preferences.writingMode as
          | 'horizontal-tb'
          | 'vertical-rl'
          | 'vertical-lr',
        aiEnabled: options.preferences.aiEnabled,
      },
    });
  }

  const envelope: PortabilityEnvelope = {
    format: PORTABILITY_FORMAT,
    version: PORTABILITY_VERSION,
    profile: PORTABILITY_PROFILE,
    id: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    scope: options.scope,
    app: {
      name: 'do-epub-studio',
      version: APP_VERSION_LABEL,
    },
    items,
  };

  const envelope2 = PortabilityEnvelopeSchema.parse(envelope);
  return envelope2;
}

/** Compact, deterministic JSON for archives. */
export function stringifyPortabilityEnvelope(envelope: PortabilityEnvelope): string {
  const envelope2 = PortabilityEnvelopeSchema.parse(envelope);
  return JSON.stringify(envelope2);
}

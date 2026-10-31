import {
  ANNOTATION_INTERCHANGE_FORMAT,
  ANNOTATION_INTERCHANGE_MAX_BYTES,
  ANNOTATION_INTERCHANGE_MAX_EXTENSION_BYTES,
  ANNOTATION_INTERCHANGE_VERSION,
  AnnotationInterchangeDocumentSchema,
  type AnnotationInterchangeDocument,
  type InterchangeAnnotation,
} from '@do-epub-studio/schema';
import type { Bookmark, Comment, Highlight } from '../../../stores/reader';

export interface InterchangeState {
  highlights: Highlight[];
  comments: Comment[];
  bookmarks: Bookmark[];
}

export function publicationIdentity(bookId: string): string {
  return `urn:do-epub-studio:publication:${encodeURIComponent(bookId)}`;
}

export function buildAnnotationInterchange(params: {
  bookId: string;
  bookTitle: string;
  state: InterchangeState;
  extensions?: Record<string, unknown>;
}): AnnotationInterchangeDocument {
  const source = publicationIdentity(params.bookId);
  const items: InterchangeAnnotation[] = [
    ...params.state.highlights.map((item) =>
      makeAnnotation(
        item.id,
        'highlighting',
        source,
        item.cfiRange,
        item.chapterRef,
        item.selectedText,
        item.note ?? '',
        item.createdAt,
        item.updatedAt,
      ),
    ),
    ...params.state.bookmarks.map((item) =>
      makeAnnotation(
        item.id,
        'bookmarking',
        source,
        item.locator.cfi,
        item.locator.chapterRef,
        item.locator.selectedText,
        item.label ?? '',
        item.createdAt,
        item.createdAt,
      ),
    ),
    ...params.state.comments
      .filter((item) => item.status !== 'deleted')
      .map((item) =>
        makeAnnotation(
          item.id,
          'commenting',
          source,
          item.cfiRange,
          item.chapterRef,
          item.selectedText ?? '',
          item.body,
          item.createdAt,
          item.updatedAt,
        ),
      ),
  ];
  if (params.extensions) {
    for (const item of items) item.extensions = params.extensions;
  }
  const document = AnnotationInterchangeDocumentSchema.parse({
    format: ANNOTATION_INTERCHANGE_FORMAT,
    version: ANNOTATION_INTERCHANGE_VERSION,
    type: 'AnnotationCollection',
    id: `urn:uuid:${crypto.randomUUID()}`,
    label: params.bookTitle,
    source,
    items,
  });
  checkSize(document);
  rejectDuplicateIds(document);
  return document;
}

function makeAnnotation(
  id: string,
  motivation: InterchangeAnnotation['motivation'],
  source: string,
  cfi: string | null | undefined,
  chapterRef: string | null | undefined,
  selectedText: string | null | undefined,
  value: string,
  created: string,
  modified: string,
): InterchangeAnnotation {
  if (!cfi || !chapterRef || !selectedText)
    throw new Error('Annotation lacks a complete EPUB locator');
  return {
    id: id.startsWith('urn:do-epub-studio:annotation:')
      ? id
      : `urn:do-epub-studio:annotation:${encodeURIComponent(id)}`,
    type: 'Annotation',
    motivation,
    created: normalizeTimestamp(created),
    modified: normalizeTimestamp(modified),
    target: {
      source,
      selector: {
        type: 'EPUBFragmentSelector',
        conformsTo: 'http://www.idpf.org/epub/linking/cfi/epub-cfi.html',
        value: cfi,
        locator: { cfi, chapterRef, selectedText },
      },
    },
    body: {
      type: 'TextualBody',
      value,
      purpose: motivation === 'commenting' ? 'commenting' : 'describing',
      format: 'text/plain',
    },
  };
}

export function parseAnnotationInterchange(
  text: string,
  expectedBookId: string,
): { document: AnnotationInterchangeDocument; state: InterchangeState } {
  if (new TextEncoder().encode(text).byteLength > ANNOTATION_INTERCHANGE_MAX_BYTES)
    throw new Error('Import exceeds the 1 MB limit');
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON');
  }
  if (input && typeof input === 'object' && 'items' in input && Array.isArray(input.items)) {
    for (const item of input.items as unknown[]) {
      if (hasExtensions(item)) {
        const extBytes = new TextEncoder().encode(JSON.stringify(item.extensions ?? {})).byteLength;
        if (extBytes > ANNOTATION_INTERCHANGE_MAX_EXTENSION_BYTES) {
          throw new Error('Extensions exceed the 32 KB limit');
        }
      }
    }
  }
  const document = AnnotationInterchangeDocumentSchema.parse(input);
  checkSize(document);
  rejectDuplicateIds(document);
  if (document.source !== publicationIdentity(expectedBookId))
    throw new Error('Publication identity does not match this book');
  const state: InterchangeState = { highlights: [], comments: [], bookmarks: [] };
  for (const item of document.items) {
    if (
      item.target.source !== document.source ||
      item.target.selector.value !== item.target.selector.locator.cfi
    )
      throw new Error('Invalid annotation target');
    const locator = item.target.selector.locator;
    const prefix = 'urn:do-epub-studio:annotation:';
    const id = item.id.startsWith(prefix)
      ? decodeURIComponent(item.id.slice(prefix.length))
      : item.id;
    if (item.motivation === 'highlighting')
      state.highlights.push({
        id,
        chapterRef: locator.chapterRef,
        cfiRange: locator.cfi,
        selectedText: locator.selectedText,
        note: item.body.value || null,
        color: '#ffff00',
        createdAt: item.created ?? '',
        updatedAt: item.modified ?? item.created ?? '',
      });
    else if (item.motivation === 'bookmarking')
      state.bookmarks.push({
        id,
        locator: {
          cfi: locator.cfi,
          chapterRef: locator.chapterRef,
          selectedText: locator.selectedText,
        },
        label: item.body.value || null,
        createdAt: item.created ?? '',
      });
    else
      state.comments.push({
        id,
        displayName: '',
        isOwn: true,
        chapterRef: locator.chapterRef,
        cfiRange: locator.cfi,
        selectedText: locator.selectedText,
        body: item.body.value,
        status: 'open',
        visibility: 'internal',
        parentCommentId: null,
        createdAt: item.created ?? '',
        updatedAt: item.modified ?? item.created ?? '',
        resolvedAt: null,
      });
  }
  return { document, state };
}
export function mergeAnnotationInterchangeDocuments(
  existing: AnnotationInterchangeDocument | null,
  incoming: AnnotationInterchangeDocument,
): AnnotationInterchangeDocument {
  if (!existing) return incoming;
  const items = new Map(existing.items.map((item) => [item.id, item]));
  for (const item of incoming.items) items.set(item.id, item);
  const merged = AnnotationInterchangeDocumentSchema.parse({
    ...existing,
    label: incoming.label || existing.label,
    items: Array.from(items.values()),
  });
  checkSize(merged);
  rejectDuplicateIds(merged);
  return merged;
}

function normalizeTimestamp(value: string): string | undefined {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}
function checkSize(document: AnnotationInterchangeDocument): void {
  const bytes = new TextEncoder().encode(JSON.stringify(document)).byteLength;
  if (bytes > ANNOTATION_INTERCHANGE_MAX_BYTES) throw new Error('Import exceeds the 1 MB limit');
  for (const item of document.items) {
    const extensionBytes = new TextEncoder().encode(
      JSON.stringify(item.extensions ?? {}),
    ).byteLength;
    if (extensionBytes > ANNOTATION_INTERCHANGE_MAX_EXTENSION_BYTES)
      throw new Error('Extensions exceed the 32 KB limit');
  }
}

function rejectDuplicateIds(document: AnnotationInterchangeDocument): void {
  const ids = new Set<string>();
  for (const item of document.items) {
    if (ids.has(item.id)) throw new Error('Duplicate annotation ID');
    ids.add(item.id);
  }
}

function hasExtensions(item: unknown): item is { extensions?: unknown } {
  return typeof item === 'object' && item !== null && 'extensions' in item;
}

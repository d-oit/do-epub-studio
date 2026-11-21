import {
  PortabilityEnvelopeSchema,
  type PortabilityEnvelope,
  type PortabilityItem,
  type PortabilityPublicationItem,
} from '@do-epub-studio/schema';
import { interchangeDocumentToState, type InterchangeState } from '../../features/reader/lib/annotation-interchange';
import { anchorIdentityKey, importMutationId } from './identity';

/**
 * Import analysis and planning for data portability.
 *
 * `analyzeImport` is pure and non-mutating: it validates the envelope (Zod),
 * compares it against the current reader state, and produces a conflict
 * preview. `planImport` turns a confirmed preview into explicit entity
 * operations with stable remapped ids and idempotency mutation ids — nothing
 * touches the server or stores until the caller executes the plan.
 */

export type AnchorQuality = 'exact' | 'weak' | 'unanchored';

export interface PreviewAnnotation {
  kind: 'highlight' | 'bookmark' | 'comment';
  sourceId: string;
  targetId: string;
  anchorQuality: AnchorQuality;
  status: 'new' | 'duplicate' | 'conflict';
}

export interface ReanchorReport {
  exact: number;
  weak: number;
  unanchored: number;
}

export interface PreviewPublication {
  bookId: string;
  title: string;
  progressStatus: 'new' | 'update' | 'identical' | 'skip';
  annotations: PreviewAnnotation[];
  reanchorReport: ReanchorReport;
}

export interface ReadinessBookState extends InterchangeState {
  progress: {
    locator: { cfi?: string } | null;
    progressPercent: number;
    updatedAt: string | null;
  } | null;
}

export interface PortabilityPreview {
  envelope: PortabilityEnvelope;
  scope: 'book' | 'account';
  publications: PreviewPublication[];
  preferences: { present: boolean; identical: boolean } | null;
  summary: {
    totalAnnotations: number;
    newAnnotations: number;
    duplicateAnnotations: number;
    conflictAnnotations: number;
    books: number;
    skippedBooks: number;
  };
}

export interface ImportEntityOperation {
  kind: 'highlight' | 'bookmark' | 'comment' | 'progress';
  bookId: string;
  sourceId: string;
  targetId: string;
  mutationId: string;
  /** API payload (create endpoints accept `mutationId` for idempotency). */
  payload: Record<string, unknown>;
}

export interface ImportPlan {
  operations: ImportEntityOperation[];
  perBook: Record<string, { annotations: number; progress: boolean }>;
}

/** Quick locator validity check matching what `tryReanchor` accepts as input. */
function cfiOk(cfi: string | null | undefined): boolean {
  return typeof cfi === 'string' && /^epubcfi\([^()]{1,1024}\)$/.test(cfi);
}

export function classifyAnchorQuality(params: {
  cfi: string | null | undefined;
  chapterRef: string | null | undefined;
  selectedText: string | null | undefined;
}): AnchorQuality {
  if (!cfiOk(params.cfi)) return 'unanchored';
  const text = (params.selectedText ?? '').trim();
  if (text.length < 10 || !params.chapterRef) return 'weak';
  return 'exact';
}

export function buildReanchorReport(annotations: PreviewAnnotation[]): ReanchorReport {
  const report: ReanchorReport = { exact: 0, weak: 0, unanchored: 0 };
  for (const annotation of annotations) {
    if (annotation.anchorQuality === 'exact') report.exact += 1;
    else if (annotation.anchorQuality === 'weak') report.weak += 1;
    else report.unanchored += 1;
  }
  return report;
}

interface CurrentAnnotations {
  highlights: Set<string>;
  comments: Set<string>;
  bookmarks: Set<string>;
}

function currentAnchorKeys(state: InterchangeState): CurrentAnnotations {
  const keyFn = (kind: 'highlight' | 'bookmark' | 'comment') => (params: {
    cfi: string | null | undefined;
    selectedText: string | null | undefined;
    chapterRef: string | null | undefined;
    body?: string | null;
  }) => anchorIdentityKey({ kind, ...params });

  const highlights = new Set(
    state.highlights.map((h) =>
      keyFn('highlight')({ cfi: h.cfiRange, selectedText: h.selectedText, chapterRef: h.chapterRef }),
    ),
  );
  const comments = new Set(
    state.comments.map((c) =>
      keyFn('comment')({
        cfi: c.cfiRange,
        selectedText: c.selectedText,
        chapterRef: c.chapterRef,
        body: c.body,
      }),
    ),
  );
  const bookmarks = new Set(
    state.bookmarks.map((b) =>
      keyFn('bookmark')({
        cfi: b.locator.cfi,
        selectedText: b.locator.selectedText,
        chapterRef: b.locator.chapterRef,
      }),
    ),
  );
  return { highlights, comments, bookmarks };
}

function progressStatus(
  incoming: PortabilityPublicationItem['progress'],
  current: ReadinessBookState['progress'],
): PreviewPublication['progressStatus'] {
  if (!incoming) return 'skip';
  if (!current) return 'new';
  if (current.progressPercent === incoming.progressPercent && current.updatedAt === incoming.updatedAt) {
    return 'identical';
  }
  return 'update';
}

function analyzePublication(
  item: PortabilityPublicationItem,
  current: ReadinessBookState | null,
): PreviewPublication {
  const state = current ?? { highlights: [], comments: [], bookmarks: [] };
  const anchorKeys = currentAnchorKeys(state);
  const incomingState = interchangeDocumentToState(item.annotations);

  // Merge locator-less orphan entities (unanchored receipts) so they are
  // counted and reported — they cannot be represented in the W3C target.
  if (item.orphans) {
    for (const h of item.orphans.highlights) {
      incomingState.highlights.push({
        id: h.id,
        chapterRef: null,
        cfiRange: null,
        selectedText: '',
        note: h.note,
        color: h.color,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
      });
    }
    for (const b of item.orphans.bookmarks) {
      incomingState.bookmarks.push({
        id: b.id,
        locator: { cfi: '', chapterRef: undefined, selectedText: undefined },
        label: b.label,
        createdAt: b.createdAt,
      });
    }
    for (const c of item.orphans.comments) {
      incomingState.comments.push({
        id: c.id,
        displayName: '',
        isOwn: true,
        chapterRef: null,
        cfiRange: null,
        selectedText: null,
        body: c.body,
        status: c.status as 'open' | 'resolved' | 'deleted',
        visibility: c.visibility as 'shared' | 'internal' | 'resolved',
        parentCommentId: c.parentCommentId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        resolvedAt: c.resolvedAt,
      });
    }
  }

  const annotations: PreviewAnnotation[] = [];
  const push = (kind: PreviewAnnotation['kind'], sourceId: string, params: {
    cfi: string | null | undefined;
    selectedText: string | null | undefined;
    chapterRef: string | null | undefined;
    body?: string | null;
  }) => {
    const key = anchorIdentityKey({ kind, ...params });
    const anchors = kind === 'highlight' ? anchorKeys.highlights : kind === 'comment' ? anchorKeys.comments : anchorKeys.bookmarks;
    const status: PreviewAnnotation['status'] = anchors.has(key) ? 'duplicate' : 'new';
    annotations.push({
      kind,
      sourceId,
      targetId: '', // assigned during planning (needs async UUID)
      anchorQuality: classifyAnchorQuality(params),
      status,
    });
  };

  for (const h of incomingState.highlights) {
    push('highlight', h.id, { cfi: h.cfiRange, selectedText: h.selectedText, chapterRef: h.chapterRef });
  }
  for (const b of incomingState.bookmarks) {
    push('bookmark', b.id, { cfi: b.locator.cfi, selectedText: b.locator.selectedText, chapterRef: b.locator.chapterRef });
  }
  for (const c of incomingState.comments) {
    push('comment', c.id, { cfi: c.cfiRange, selectedText: c.selectedText, chapterRef: c.chapterRef, body: c.body });
  }

  // Sources that exactly match an existing entity id are conflicts (same id,
  // different payload) rather than plain duplicates.
  const existingIds = new Set<string>([
    ...state.highlights.map((h) => h.id),
    ...state.comments.map((c) => c.id),
    ...state.bookmarks.map((b) => b.id),
  ]);
  for (const annotation of annotations) {
    if (existingIds.has(annotation.sourceId) && annotation.status === 'new') {
      annotation.status = 'conflict';
    }
  }

  return {
    bookId: item.bookId,
    title: item.title,
    progressStatus: progressStatus(item.progress, current?.progress ?? null),
    annotations,
    reanchorReport: buildReanchorReport(annotations),
  };
}

/**
 * Validate and analyze an envelope against the current library state. Pure:
 * returns a preview, never mutates anything.
 */
export function analyzeImport(
  text: string,
  currentByBook: Record<string, ReadinessBookState | null>,
): PortabilityPreview {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON: not a portability archive');
  }
  const envelope = PortabilityEnvelopeSchema.parse(input);

  const publications: PreviewPublication[] = [];
  for (const item of envelope.items) {
    if (item.type === 'publication') {
      publications.push(analyzePublication(item, currentByBook[item.bookId] ?? null));
    }
  }

  const preferencesItem = envelope.items.find((i): i is Extract<PortabilityItem, { type: 'preferences' }> => i.type === 'preferences');
  const preferences = preferencesItem ? { present: true, identical: false } : null;

  const totalAnnotations = publications.reduce((n, p) => n + p.annotations.length, 0);
  const newAnnotations = publications.reduce((n, p) => n + p.annotations.filter((a) => a.status === 'new').length, 0);
  const duplicateAnnotations = publications.reduce((n, p) => n + p.annotations.filter((a) => a.status === 'duplicate').length, 0);
  const conflictAnnotations = publications.reduce((n, p) => n + p.annotations.filter((a) => a.status === 'conflict').length, 0);
  const skippedBooks = publications.filter((p) => p.progressStatus === 'skip').length;

  return {
    envelope,
    scope: envelope.scope,
    publications,
    preferences,
    summary: {
      totalAnnotations,
      newAnnotations,
      duplicateAnnotations,
      conflictAnnotations,
      books: publications.length,
      skippedBooks,
    },
  };
}

/**
 * Build the explicit operation plan for a confirmed preview. IDs are remapped
 * to deterministic v5 UUIDs derived from the envelope id + source id, so
 * re-importing the same archive replays identical ids (idempotent).
 */
export async function planImport(
  preview: PortabilityPreview,
): Promise<ImportPlan> {
  const operations: ImportEntityOperation[] = [];
  const perBook: ImportPlan['perBook'] = {};
  const envelopeId = preview.envelope.id;

  for (const publication of preview.publications) {
    const bookOps: { annotations: number; progress: boolean } = { annotations: 0, progress: false };
    const item = preview.envelope.items.find(
      (i): i is PortabilityPublicationItem => i.type === 'publication' && i.bookId === publication.bookId,
    );
    if (!item) continue;
    const state = interchangeDocumentToState(item.annotations);

    for (const annotation of publication.annotations) {
      if (annotation.status !== 'new') continue;
      const mutationId = await importMutationId(envelopeId, `${publication.bookId}:${annotation.sourceId}`);
      const targetId = await importMutationId(envelopeId, `entity:${publication.bookId}:${annotation.sourceId}`);
      annotation.targetId = targetId;
      const source = state.highlights.find((h) => h.id === annotation.sourceId)
        ?? state.comments.find((c) => c.id === annotation.sourceId)
        ?? state.bookmarks.find((b) => b.id === annotation.sourceId);
      if (!source) continue;

      // Locator-less orphans cannot be created through the API (create
      // endpoints require a full multi-signal locator); they are reported
      // as unanchored and left for the reader's re-anchor flow.
      const hasCfi =
        annotation.kind === 'bookmark'
          ? Boolean((source as typeof state.bookmarks[number]).locator?.cfi)
          : Boolean((source as typeof state.highlights[number]).cfiRange);
      if (!hasCfi) continue;
      let payload: Record<string, unknown>;
      if (annotation.kind === 'highlight') {
        const h = source as typeof state.highlights[number];
        payload = {
          mutationId,
          locator: {
            chapterRef: h.chapterRef,
            cfi: h.cfiRange,
            selectedText: h.selectedText,
          },
          note: h.note ?? undefined,
          color: h.color,
        };
      } else if (annotation.kind === 'comment') {
        const c = source as typeof state.comments[number];
        payload = {
          mutationId,
          locator: {
            chapterRef: c.chapterRef,
            cfi: c.cfiRange,
            selectedText: c.selectedText,
          },
          body: c.body,
          visibility: c.visibility === 'resolved' ? 'shared' : c.visibility,
          parentCommentId: c.parentCommentId ?? undefined,
        };
      } else {
        const b = source as typeof state.bookmarks[number];
        payload = {
          mutationId,
          locator: {
            cfi: b.locator.cfi,
            chapterRef: b.locator.chapterRef,
            selectedText: b.locator.selectedText,
          },
          label: b.label ?? undefined,
        };
      }
      operations.push({ kind: annotation.kind, bookId: publication.bookId, sourceId: annotation.sourceId, targetId, mutationId, payload });
      bookOps.annotations += 1;
    }

    if (item.progress && publication.progressStatus !== 'skip' && publication.progressStatus !== 'identical') {
      const mutationId = await importMutationId(envelopeId, `progress:${publication.bookId}`);
      operations.push({
        kind: 'progress',
        bookId: publication.bookId,
        sourceId: 'progress',
        targetId: '',
        mutationId,
        payload: {
          mutationId,
          baseRevision: 0,
          locator: item.progress.locator ?? {},
          progressPercent: item.progress.progressPercent,
        },
      });
      bookOps.progress = true;
    }

    perBook[publication.bookId] = bookOps;
  }

  return { operations, perBook };
}

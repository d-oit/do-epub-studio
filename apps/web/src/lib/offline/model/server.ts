/**
 * In-memory mirror of the worker's sync-facing API surface. It reproduces the
 * *behavioral contract* of the D1-backed Hono routes for annotations, comments,
 * bookmarks and progress — including mutation_id idempotency, progress
 * revision conflicts, and soft-delete tombstones — so the real client sync
 * code runs against it unchanged.
 *
 * Documented deviations from the real worker (none affect the contract under
 * test):
 * - D1 transactions/optimistic UPDATE ... WHERE revision = ? are simulated by
 *   an equivalent synchronous state transition.
 * - Auth (readerAuth) and tenant isolation are handled by the transport
 *   adapter (bearer presence) and by the server's single-user book scope.
 * - Audit logging, FTS, notifications and locator parsing are omitted.
 * - IDs are deterministic counters instead of crypto.randomUUID().
 */

import {
  cfiLocator,
  errorBody,
  num,
  progressData,
  sleepNow,
  str,
  toCommentDto,
  toHighlightDto,
} from './server-utils';
import type {
  RemoteAction,
  ServerBookmarkRow,
  ServerCommentRow,
  ServerHighlightRow,
  ServerProgressRow,
  ServerSnapshot,
} from './types';

export interface ApplyRequest {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

export interface ApplyResult {
  status: number;
  body: Record<string, unknown>;
  /** The server applied a mutation (vs. error / replay / no-op). */
  committed: boolean;
  /** Request was recognized as a replay of a previously applied mutation. */
  replay: boolean;
  errorCode?: string;
}

export class InMemorySyncServer {
  highlights = new Map<string, ServerHighlightRow>();

  comments = new Map<string, ServerCommentRow>();

  bookmarks = new Map<string, ServerBookmarkRow>();

  progress: ServerProgressRow | null = null;

  /** mirror of `reading_progress_mutations` (book + user scoped here) */
  progressMutations = new Map<string, ServerProgressRow>();

  /** Optional hook invoked right before a mutation is applied (race tests). */
  beforeApply: ((path: string) => void) | null = null;

  private counter = 0;

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  applyRequest(req: ApplyRequest): ApplyResult {
    const { method, path } = req;
    const highlightMatch = path.match(/^\/api\/books\/([^/]+)\/highlights(?:\/([^/]+))?$/);
    if (highlightMatch) {
      const bookId = highlightMatch[1] ?? '';
      const id = highlightMatch[2] ?? null;
      if (method === 'POST') return this.createHighlight(bookId, req.body);
      if (method === 'PATCH' && id) return this.patchHighlight(id, req.body);
      if (method === 'DELETE' && id) return this.deleteHighlight(id);
    }
    const commentMatch = path.match(/^\/api\/books\/([^/]+)\/comments$/);
    if (commentMatch && method === 'POST') {
      return this.createComment(commentMatch[1] ?? '', req.body);
    }
    const commentPatch = path.match(/^\/api\/comments\/([^/]+)$/);
    if (commentPatch) {
      const id = commentPatch[1] ?? '';
      if (method === 'PATCH') return this.patchComment(id, req.body);
      if (method === 'DELETE') return this.deleteComment(id);
    }
    const bookmarkMatch = path.match(/^\/api\/books\/([^/]+)\/bookmarks(?:\/([^/]+))?$/);
    if (bookmarkMatch) {
      const bookId = bookmarkMatch[1] ?? '';
      const id = bookmarkMatch[2] ?? null;
      if (method === 'POST') return this.createBookmark(bookId, req.body);
      if (method === 'DELETE' && id) return this.deleteBookmark(id);
    }
    if (path.endsWith('/progress')) {
      if (method === 'GET') return this.getProgress();
      if (method === 'PUT') return this.putProgress(req.body);
    }
    return {
      status: 404,
      body: errorBody('Not found', 'NOT_FOUND'),
      committed: false,
      replay: false,
    };
  }

  applyRemote(action: RemoteAction): ApplyResult {
    const body = (action as { body?: Record<string, unknown> }).body ?? null;
    switch (action.kind) {
      case 'createHighlight':
        return this.createHighlight('book-1', body);
      case 'editHighlight':
        return this.patchHighlight(action.id, body);
      case 'deleteHighlight':
        return this.deleteHighlight(action.id);
      case 'createComment':
        return this.createComment('book-1', body);
      case 'editComment':
        return this.patchComment(action.id, body);
      case 'deleteComment':
        return this.deleteComment(action.id);
      case 'createBookmark':
        return this.createBookmark('book-1', body);
      case 'deleteBookmark':
        return this.deleteBookmark(action.id);
      case 'putProgress':
        return this.putProgress(body);
    }
  }

  private createHighlight(bookId: string, body: Record<string, unknown> | null): ApplyResult {
    const mutationId = str(body, 'mutationId') ?? null;
    let row: ServerHighlightRow | undefined;
    if (mutationId !== null) {
      for (const existing of this.highlights.values()) {
        if (existing.mutationId === mutationId) {
          row = existing;
          break;
        }
      }
      if (row) {
        if (row.bookId !== bookId) {
          return {
            status: 403,
            body: errorBody('Access denied', 'FORBIDDEN'),
            committed: false,
            replay: true,
          };
        }
        return {
          status: 200,
          body: { ok: true, data: toHighlightDto(row) },
          committed: false,
          replay: true,
        };
      }
    }
    const locator = (body?.locator as Record<string, unknown> | undefined) ?? {};
    this.beforeApply?.(`/api/books/${bookId}/highlights`);
    row = {
      id: this.nextId('srv-hl'),
      bookId,
      userEmail: 'reader@example.com',
      mutationId,
      chapterRef: str(locator, 'chapterRef') ?? null,
      cfiRange: str(locator, 'cfi') ?? null,
      selectedText: str(locator, 'selectedText') ?? '',
      note: str(body, 'note') ?? null,
      color: str(body, 'color') ?? '#ffff00',
      createdAt: sleepNow(),
      updatedAt: sleepNow(),
    };
    this.highlights.set(row.id, row);
    return {
      status: 201,
      body: { ok: true, data: toHighlightDto(row) },
      committed: true,
      replay: false,
    };
  }

  private patchHighlight(id: string, body: Record<string, unknown> | null): ApplyResult {
    const row = this.highlights.get(id);
    if (!row)
      return {
        status: 404,
        body: errorBody('Highlight', 'NOT_FOUND'),
        committed: false,
        replay: false,
      };
    const note = str(body, 'note');
    if (note !== undefined) row.note = note;
    const color = str(body, 'color');
    if (color !== undefined) row.color = color;
    row.updatedAt = sleepNow();
    return {
      status: 200,
      body: { ok: true, data: { id, ...body } },
      committed: true,
      replay: false,
    };
  }

  private deleteHighlight(id: string): ApplyResult {
    this.highlights.delete(id);
    return { status: 200, body: { ok: true }, committed: true, replay: false };
  }

  private createComment(bookId: string, body: Record<string, unknown> | null): ApplyResult {
    const mutationId = str(body, 'mutationId') ?? null;
    let row: ServerCommentRow | undefined;
    if (mutationId !== null) {
      for (const existing of this.comments.values()) {
        if (existing.mutationId === mutationId) {
          row = existing;
          break;
        }
      }
      if (row) {
        if (row.bookId !== bookId) {
          return {
            status: 403,
            body: errorBody('Access denied', 'FORBIDDEN'),
            committed: false,
            replay: true,
          };
        }
        return {
          status: 200,
          body: { ok: true, data: toCommentDto(row) },
          committed: false,
          replay: true,
        };
      }
    }
    const locator = (body?.locator as Record<string, unknown> | undefined) ?? {};
    this.beforeApply?.(`/api/books/${bookId}/comments`);
    row = {
      id: this.nextId('srv-cm'),
      bookId,
      userEmail: 'reader@example.com',
      mutationId,
      chapterRef: str(locator, 'chapterRef') ?? null,
      cfiRange: str(locator, 'cfi') ?? null,
      selectedText: str(locator, 'selectedText') ?? null,
      body: str(body, 'body') ?? '',
      visibility: str(body, 'visibility') ?? 'shared',
      status: 'open',
      parentCommentId: null,
      createdAt: sleepNow(),
      updatedAt: sleepNow(),
      resolvedAt: null,
    };
    this.comments.set(row.id, row);
    return {
      status: 201,
      body: { ok: true, data: toCommentDto(row) },
      committed: true,
      replay: false,
    };
  }

  private patchComment(id: string, body: Record<string, unknown> | null): ApplyResult {
    const row = this.comments.get(id);
    if (!row)
      return {
        status: 404,
        body: errorBody('Comment', 'NOT_FOUND'),
        committed: false,
        replay: false,
      };
    const nextBody = str(body, 'body');
    if (nextBody !== undefined) row.body = nextBody;
    const status = str(body, 'status');
    if (status !== undefined) row.status = status;
    const visibility = str(body, 'visibility');
    if (visibility !== undefined) row.visibility = visibility;
    row.updatedAt = sleepNow();
    if (row.status === 'resolved' && !row.resolvedAt) row.resolvedAt = sleepNow();
    return {
      status: 200,
      body: { ok: true, data: { id, ...body } },
      committed: true,
      replay: false,
    };
  }

  private deleteComment(id: string): ApplyResult {
    const row = this.comments.get(id);
    if (!row)
      return {
        status: 404,
        body: errorBody('Comment', 'NOT_FOUND'),
        committed: false,
        replay: false,
      };
    row.status = 'deleted';
    row.updatedAt = sleepNow();
    return { status: 200, body: { ok: true }, committed: true, replay: false };
  }

  private createBookmark(bookId: string, body: Record<string, unknown> | null): ApplyResult {
    const mutationId = str(body, 'mutationId') ?? null;
    let row: ServerBookmarkRow | undefined;
    if (mutationId !== null) {
      for (const existing of this.bookmarks.values()) {
        if (existing.mutationId === mutationId) {
          row = existing;
          break;
        }
      }
      if (row) {
        if (row.bookId !== bookId) {
          return {
            status: 403,
            body: errorBody('Access denied', 'FORBIDDEN'),
            committed: false,
            replay: true,
          };
        }
        return { status: 200, body: { ok: true, data: row }, committed: false, replay: true };
      }
    }
    const locatorRaw = (body?.locator as Record<string, unknown> | undefined) ?? {};
    this.beforeApply?.(`/api/books/${bookId}/bookmarks`);
    row = {
      id: this.nextId('srv-bm'),
      bookId,
      userEmail: 'reader@example.com',
      mutationId,
      locator: {
        cfi: str(locatorRaw, 'cfi') ?? '',
        ...(str(locatorRaw, 'chapterRef') !== undefined
          ? { chapterRef: str(locatorRaw, 'chapterRef') ?? '' }
          : {}),
      },
      label: str(body, 'label') ?? '',
      createdAt: sleepNow(),
    };
    this.bookmarks.set(row.id, row);
    return { status: 201, body: { ok: true, data: row }, committed: true, replay: false };
  }

  private deleteBookmark(id: string): ApplyResult {
    this.bookmarks.delete(id);
    return { status: 200, body: { ok: true }, committed: true, replay: false };
  }

  private getProgress(): ApplyResult {
    if (!this.progress) {
      return {
        status: 200,
        body: {
          ok: true,
          data: { locator: null, progressPercent: 0, updatedAt: null, revision: 0 },
        },
        committed: false,
        replay: false,
      };
    }
    return {
      status: 200,
      body: { ok: true, data: progressData(this.progress) },
      committed: false,
      replay: false,
    };
  }

  private putProgress(body: Record<string, unknown> | null): ApplyResult {
    const mutationId = str(body, 'mutationId') ?? '';
    const replaySnapshot = this.progressMutations.get(mutationId);
    if (replaySnapshot) {
      return {
        status: 200,
        body: { ok: true, data: progressData(replaySnapshot) },
        committed: false,
        replay: true,
      };
    }
    if (this.progress && this.progress.mutationId === mutationId) {
      return {
        status: 200,
        body: { ok: true, data: progressData(this.progress) },
        committed: false,
        replay: true,
      };
    }
    const now = sleepNow();
    const baseRevision = num(body, 'baseRevision') ?? 0;
    const dependsOn = str(body, 'dependsOnMutationId');
    const locator = cfiLocator(body);
    const progressPercent = num(body, 'progressPercent') ?? 0;
    // Simulate the race window between the client's snapshot and this write:
    // the server state may move before the revision check runs.
    this.beforeApply?.('/api/books/book-1/progress');
    const existing = this.progress;
    if (existing) {
      const followsLocalMutation =
        dependsOn !== undefined &&
        dependsOn === existing.mutationId &&
        existing.revision > baseRevision;
      if (existing.revision !== baseRevision && !followsLocalMutation) {
        return {
          status: 409,
          body: errorBody('Reading progress changed on the server', 'PROGRESS_CONFLICT'),
          committed: false,
          replay: false,
          errorCode: 'PROGRESS_CONFLICT',
        };
      }
      existing.locator = locator;
      existing.progressPercent = progressPercent;
      existing.updatedAt = now;
      existing.revision += 1;
      existing.mutationId = mutationId;
      this.progressMutations.set(mutationId, { ...existing });
    } else {
      if (baseRevision !== 0 || dependsOn !== undefined) {
        return {
          status: 409,
          body: errorBody('Reading progress changed on the server', 'PROGRESS_CONFLICT'),
          committed: false,
          replay: false,
          errorCode: 'PROGRESS_CONFLICT',
        };
      }
      this.progress = {
        id: this.nextId('srv-pr'),
        bookId: 'book-1',
        userEmail: 'reader@example.com',
        locator,
        progressPercent,
        updatedAt: now,
        revision: 1,
        mutationId,
      };
      this.progressMutations.set(mutationId, { ...this.progress });
    }
    const applied = this.progressMutations.get(mutationId);
    if (!applied) {
      return {
        status: 409,
        body: errorBody('Reading progress changed on the server', 'PROGRESS_CONFLICT'),
        committed: false,
        replay: false,
        errorCode: 'PROGRESS_CONFLICT',
      };
    }
    return {
      status: 200,
      body: { ok: true, data: progressData(applied) },
      committed: true,
      replay: false,
    };
  }

  snapshot(): ServerSnapshot {
    return {
      highlights: [...this.highlights.values()],
      comments: [...this.comments.values()],
      bookmarks: [...this.bookmarks.values()],
      progress: this.progress ? { ...this.progress } : null,
      progressMutations: [...this.progressMutations.values()].map((m) => ({
        mutationId: m.mutationId,
        revision: m.revision,
      })),
    };
  }

}

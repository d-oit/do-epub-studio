/**
 * Model harness: drives the REAL offline sync engine
 * (`persistAnnotationCreation` / `queueSync` / `saveProgress` / `syncAll` /
 * conflict actions) against the InMemorySyncServer via the Transport shim,
 * and reconciles observable state against a ledger of every local mutation.
 *
 * The ledger + invariant checks implement the issue's acceptance contract:
 * - acknowledged changes never disappear silently (each mutation ends synced,
 *   conflicted, still queued, or visibly failed);
 * - repeated sync is idempotent and duplicate delivery is exactly-once;
 * - conflicts are explicit wherever automatic merge is unsafe (never blind
 *   last-write-wins for progress);
 * - deletion tombstones win over stale creates;
 * - session/offline fences stop server writes.
 */

import {
  persistAnnotationCreation,
  saveAnnotation,
} from '../annotation-mutations';
import {
  getDB,
  closeDb,
  saveProgress,
  decryptEntry,
  SYNC_QUEUE_PLAINTEXT,
  ANNOTATION_PLAINTEXT,
  type SyncQueueItem,
  type AnnotationEntry,
} from '../db';
import { queueSync, syncAll, cancelPendingRetry, resetDrainPromise } from '../sync';
import {
  __clearConflictCache,
  clearAllConflicts,
  flushConflictWrites,
  getPendingConflicts,
  ConflictType,
} from '../conflict-resolution';
import { useAuthStore } from '../../../stores/auth';
import { useReaderStore } from '../../../stores/reader';
import { Transport } from './transport';
import type {
  FailureDirective,
  LedgerEntry,
  LedgerKind,
  RemoteAction,
} from './types';

const DB_NAME = 'do-epub-studio';
const BOOK_ID = 'book-1';
const USER_EMAIL = 'reader@example.com';
const TOKEN = 'model-session-token';

export class ModelSuiteError extends Error {}

export function replayCommand(seed: number): string {
  return `REPLAY_SEED=${seed} pnpm --filter @do-epub-studio/web exec vitest run src/lib/offline/sync-model-targeted.test.ts`;
}

/** Deterministic JSON fingerprint (sorted keys) used to match conflict payloads. */
function fingerprint(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

async function resetLocalDb(): Promise<void> {
  closeDb();
  const { promise, resolve } = Promise.withResolvers<void>();
  const req = indexedDB.deleteDatabase(DB_NAME);
  req.onsuccess = () => resolve();
  req.onerror = () => resolve();
  req.onblocked = () => resolve();
  await promise;
}

export class Harness {
  readonly transport = new Transport();

  readonly ledger = new Map<string, LedgerEntry>();

  readonly requests = this.transport.log;

  readonly trace: string[] = [];

  progressBaseRevision = 0;

  pendingProgressMutationId: string | null = null;

  private lastSeenRevision = 0;

  private observedDeletedCommentIds = new Set<string>();

  private observedDeletedEntityIds = new Set<string>();

  private serverIdByMutationId = new Map<string, string>();

  private uninstallTransport: (() => void) | null = null;

  private scenarioCleanup: (() => void) | null = null;

  async resetScenario(): Promise<void> {
    cancelPendingRetry();
    resetDrainPromise();
    clearAllConflicts();
    __clearConflictCache();
    await flushConflictWrites();
    this.uninstallTransport?.();
    this.uninstallTransport = null;
    this.scenarioCleanup?.();
    this.scenarioCleanup = null;
    await resetLocalDb();
    this.transport.log.length = 0;
    this.transport.directives.length = 0;
    this.transport.authMode = 'enforce';
    this.progressBaseRevision = 0;
    this.pendingProgressMutationId = null;
    this.lastSeenRevision = 0;
    this.observedDeletedCommentIds.clear();
    this.observedDeletedEntityIds.clear();
    this.serverIdByMutationId.clear();
    this.setOnline(true);
    this.login();
    this.uninstallTransport = this.transport.install();
  }

  finishScenario(): void {
    this.uninstallTransport?.();
    this.uninstallTransport = null;
    cancelPendingRetry();
    resetDrainPromise();
  }

  setOnline(online: boolean): void {
    Object.defineProperty(navigator, 'onLine', { value: online, writable: true, configurable: true });
  }

  login(): void {
    useAuthStore.setState({
      sessionToken: TOKEN,
      sessionExpiresAt: null,
      bookId: BOOK_ID,
      bookSlug: 'slug',
      bookTitle: 'title',
      email: USER_EMAIL,
      capabilities: {
        canRead: true,
        canHighlight: true,
        canComment: true,
        canBookmark: true,
        canDownloadOffline: true,
        canExportNotes: true,
        canManageAccess: true,
      },
      isAuthenticated: true,
      isAdmin: false,
      sessionExpired: false,
    });
    useReaderStore.setState({
      progress: { locator: null, progressPercent: 0, updatedAt: null, revision: 0 },
    });
  }

  logout(): void {
    useAuthStore.getState().logout('manual');
  }

  get authed(): boolean {
    return useAuthStore.getState().sessionToken !== null;
  }

  private traceOp(line: string): void {
    this.trace.push(`#${this.trace.length} ${line}`);
  }

  private addLedger(kind: LedgerKind, mutationId: string, targetStatus?: string): void {
    this.ledger.set(mutationId, {
      mutationId,
      kind,
      fingerprint: '',
      serverId: null,
      stage: 'enqueued',
      ...(targetStatus ? { targetStatus } : {}),
    });
  }

  /** Local annotation create (offline path: persist + queue). */
  async createAnnotation(kind: 'highlight' | 'comment' | 'bookmark', fields: {
    cfi: string;
    text: string;
    chapter?: string;
    color?: string;
    body?: string;
    label?: string;
  }): Promise<string> {
    const mutationId = crypto.randomUUID();
    const now = Date.now();
    const entry: AnnotationEntry = {
      id: `local-annotation-${mutationId}`,
      bookId: BOOK_ID,
      type: kind,
      cfi: fields.cfi,
      text: fields.text,
      chapter: fields.chapter,
      color: fields.color ?? '#ffff00',
      createdAt: now,
      updatedAt: now,
      synced: false,
      mutationId,
    };
    if (kind === 'comment') {
      entry.comment = fields.body ?? '';
      entry.displayName = 're***';
      entry.status = 'open';
      entry.visibility = 'shared';
    }
    if (kind === 'bookmark') {
      entry.text = fields.label ?? entry.text;
    }
    await persistAnnotationCreation(entry, TOKEN);
    this.addLedger(kind, mutationId);
    this.traceOp(`create${kind[0]?.toUpperCase() ?? ''}${kind.slice(1)} mid=${mutationId.slice(0, 8)}`);
    return mutationId;
  }

  /** Offline comment resolve (Plan 998 action payload). */
  async resolveComment(commentServerId: string, targetStatus: 'open' | 'resolved'): Promise<string> {
    const mutationId = crypto.randomUUID();
    await saveAnnotation({
      id: commentServerId,
      bookId: BOOK_ID,
      type: 'comment',
      cfi: 'epubcfi(/6/1)',
      comment: 'body',
      createdAt: Date.now(),
      synced: false,
      mutationId,
      status: targetStatus,
      visibility: 'shared',
    });
    await queueSync(
      'annotation',
      { bookId: BOOK_ID, annotation: { id: commentServerId, status: targetStatus }, action: 'resolve' },
      mutationId,
    );
    this.addLedger('resolve', mutationId, targetStatus);
    const ledgerEntry = this.ledger.get(mutationId);
    if (ledgerEntry) ledgerEntry.serverId = commentServerId;
    this.traceOp(`resolveComment ${commentServerId} -> ${targetStatus}`);
    return mutationId;
  }

  /** Offline progress update (same payload shape as the reader hook). */
  async updateProgress(cfi: string, percentage: number, dependsOnMutationId?: string): Promise<string> {
    const mutationId = crypto.randomUUID();
    const payload = {
      bookId: BOOK_ID,
      cfi,
      percentage,
      mutationId,
      baseRevision: this.progressBaseRevision,
      ...(dependsOnMutationId ? { dependsOnMutationId } : {}),
    };
    await saveProgress({
      id: `${BOOK_ID}-progress`,
      bookId: BOOK_ID,
      cfi,
      percentage,
      lastRead: Date.now(),
      synced: false,
      mutationId,
      baseRevision: this.progressBaseRevision,
    });
    await queueSync('progress', payload, mutationId);
    this.addLedger('progress', mutationId);
    const progressEntry = this.ledger.get(mutationId);
    if (progressEntry) progressEntry.fingerprint = fingerprint(payload);
    if (!dependsOnMutationId) this.pendingProgressMutationId = mutationId;
    this.traceOp(`updateProgress cfi=${cfi} pct=${percentage} base=${this.progressBaseRevision}`);
    return mutationId;
  }

  /** Remote (peer-device) write executed directly against the server. */
  remoteWrite(action: RemoteAction): void {
    if (action.kind === 'deleteHighlight' || action.kind === 'deleteBookmark') {
      this.observedDeletedEntityIds.add(action.id);
    }
    if (action.kind === 'deleteComment') {
      this.observedDeletedEntityIds.add(action.id);
    }
    const result = this.transport.server.applyRemote(action);
    const mutationId = (action as { body?: { mutationId?: string } }).body?.mutationId ?? null;
    this.requests.push({
      n: this.requests.length + 1,
      source: 'remote',
      method: action.kind.startsWith('delete') ? 'DELETE' : action.kind.startsWith('edit') ? 'PATCH' : 'POST',
      path: `/remote/${action.kind}`,
      mutationId,
      status: result.status,
      committed: result.committed,
      replay: result.replay,
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
    });
    this.traceOp(`remote ${action.kind} status=${result.status}`);
  }

  injectDirective(directive: FailureDirective): void {
    this.transport.addDirective(directive);
    this.traceOp(`inject ${directive.kind}@${directive.path} x${directive.times}`);
  }

  /**
   * Bounded re-drain loop: drives retries until the queue settles, then
   * probes idempotency by running two more empty drains and asserting the
   * server snapshot is stable. Also refreshes the client's base revision to
   * mirror the app updating its stored revision after a successful sync.
   */
  async quiesce(): Promise<string[]> {
    cancelPendingRetry();
    for (let i = 0; i < 14; i++) {
      const before = this.requests.length;
      await syncAll();
      if (this.requests.length === before) break;
    }
    const snap = this.transport.server.snapshot();
    for (const kind of ['highlights', 'comments', 'bookmarks'] as const) {
      for (const row of snap[kind]) {
        if (row.mutationId !== null) {
          this.serverIdByMutationId.set(row.mutationId, row.id);
        }
      }
    }
    const p = snap.progress;
    if (p && p.mutationId !== null) {
      this.progressBaseRevision = p.revision;
    }
    const probeBefore = JSON.stringify(sortKeys(this.transport.server.snapshot()));
    await syncAll();
    await syncAll();
    const probeAfter = JSON.stringify(sortKeys(this.transport.server.snapshot()));
    if (probeBefore !== probeAfter) {
      return ['repeated sync changed server state (not idempotent)'];
    }
    return [];
  }

  checkLightInvariants(): string[] {
    const violations: string[] = [];
    const snap = this.transport.server.snapshot();

    for (const kind of ['highlights', 'comments', 'bookmarks'] as const) {
      const rows = snap[kind];
      const seen = new Set<string | null>();
      for (const row of rows) {
        if (row.mutationId === null) continue;
        if (seen.has(row.mutationId)) {
          violations.push(`server uniqueness violated: duplicate ${kind} row for mutation ${row.mutationId}`);
        }
        seen.add(row.mutationId);
        this.serverIdByMutationId.set(row.mutationId, row.id);
      }
    }

    if (snap.progress) {
      if (snap.progress.revision < this.lastSeenRevision) {
        violations.push(
          `progress revision went backwards: ${this.lastSeenRevision} -> ${snap.progress.revision}`,
        );
      }
      this.lastSeenRevision = snap.progress.revision;
    }

    for (const row of snap.comments) {
      if (row.status === 'deleted') this.observedDeletedCommentIds.add(row.id);
    }

    return violations;
  }

  /** Deep audit: decrypts local stores, reconciles the ledger. */
  async deepAudit(): Promise<string[]> {
    const violations = this.checkLightInvariants();
    // While logged out the local encrypted stores are intentionally
    // inaccessible (session key gone), so ledger reconciliation cannot read
    // them; checks resume after the next login.
    if (!this.authed) return violations;
    const snap = this.transport.server.snapshot();
    const db = await getDB();

    const rawQueue = (await db.getAll('syncQueue')) as Record<string, unknown>[];
    const queued = new Map<string, SyncQueueItem>();
    for (const raw of rawQueue) {
      const item = await decryptEntry<SyncQueueItem>(raw, SYNC_QUEUE_PLAINTEXT);
      if (item) queued.set(item.mutationId, item);
    }

    const rawAnnotations = (await db.getAll('annotations')) as Record<string, unknown>[];
    const annotations: AnnotationEntry[] = [];
    for (const raw of rawAnnotations) {
      const entry = await decryptEntry<AnnotationEntry>(raw, ANNOTATION_PLAINTEXT);
      if (entry) annotations.push(entry);
    }

    const conflicts = getPendingConflicts(BOOK_ID);

    for (const entry of this.ledger.values()) {
      if (entry.settled) continue;
      const mid = entry.mutationId;
      const queuedItem = queued.get(mid);
      const localAnnotation = annotations.find((a) => a.mutationId === mid);

      if (entry.kind === 'progress') {
        const applied = snap.progressMutations.some((m) => m.mutationId === mid);
        const conflicted = conflicts.some(
          (c) => c.type === ConflictType.ProgressUpdate && fingerprint(c.localVersion) === entry.fingerprint,
        );
        if (applied) {
          entry.settled = true;
          entry.stage = 'synced';
          continue;
        }
        if (conflicted) {
          entry.settled = true;
          entry.stage = 'conflicted';
          continue;
        }
        if (queuedItem) continue;
        violations.push(`ledger: progress mutation ${mid} disappeared without trace (not applied, not conflicted, not queued)`);
        continue;
      }

      if (entry.kind === 'resolve') {
        const row = snap.comments.find((c) => c.id === entry.serverId);
        if (row && row.status === entry.targetStatus) {
          entry.settled = true;
          entry.stage = 'synced';
          continue;
        }
        // A later resolve on the same comment legitimately supersedes this one
        // (open/resolved toggles); settle if the current row reflects it.
        const superseding = [...this.ledger.values()].some(
          (other) =>
            other !== entry &&
            other.kind === 'resolve' &&
            other.serverId === entry.serverId &&
            other.targetStatus === row?.status,
        );
        if (row && superseding) {
          entry.settled = true;
          entry.stage = 'synced';
          continue;
        }
        if (queuedItem?.permanentError) {
          entry.settled = true;
          entry.stage = 'terminal';
          continue;
        }
        if (queuedItem) continue;
        violations.push(`ledger: resolve ${mid} target ${entry.serverId} not reflected on server and not queued`);
        continue;
      }

      const row = snap[entry.kind === 'highlight' ? 'highlights' : entry.kind === 'comment' ? 'comments' : 'bookmarks']
        .find((r) => r.mutationId === mid);
      if (row) {
        entry.serverId = row.id;
        entry.settled = true;
        entry.stage = 'synced';
        continue;
      }
      const serverId = entry.serverId ?? this.serverIdByMutationId.get(mid);
      if (serverId && this.observedDeletedEntityIds.has(serverId)) {
        entry.settled = true;
        entry.stage = 'purged';
        entry.terminalReason = 'deleted_by_peer';
        continue;
      }
      if (queuedItem?.permanentError) {
        entry.settled = true;
        entry.stage = 'terminal';
        continue;
      }
      if (queuedItem) continue;
      if (localAnnotation?.syncError) {
        entry.settled = true;
        entry.stage = 'terminal';
        continue;
      }
      violations.push(`ledger: ${entry.kind} mutation ${mid} lost (no server row, no queue item, no failure marker)`);
    }

    // Tombstone stability: a deleted comment must never be resurrected by a
    // stale create replay of the same mutation id. Explicit user resolves on
    // the comment are allowed to revive it (the server contract permits the
    // PATCH and the user acted deliberately).
    for (const deletedId of this.observedDeletedCommentIds) {
      const row = snap.comments.find((c) => c.id === deletedId);
      if (row && row.status !== 'deleted') {
        const revivedByResolve = [...this.ledger.values()].some(
          (e) => e.kind === 'resolve' && e.serverId === deletedId && e.targetStatus === row.status,
        );
        if (!revivedByResolve) {
          violations.push(`tombstone resurrected: comment ${deletedId} is ${row.status}`);
        }
      }
    }

    return violations;
  }
}

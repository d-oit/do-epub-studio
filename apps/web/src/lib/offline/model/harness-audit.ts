/**
 * Deep ledger reconciliation for the offline sync model harness (issue #1486).
 *
 * Extracted from `harness.ts` to stay under the 500-line cap. Decrypts the
 * local stores and settles every ledger entry against durable evidence:
 * a server row, a queued mutation, an explicit conflict, or a terminal
 * failure marker. Anything else is a lost acknowledged change.
 */
import { getDB, decryptEntry, SYNC_QUEUE_PLAINTEXT, ANNOTATION_PLAINTEXT } from '../db';
import type { SyncQueueItem, AnnotationEntry } from '../db';
import { getPendingConflicts, ConflictType } from '../conflict-resolution';
import type { LedgerEntry, ServerSnapshot } from './types';
import { fingerprint } from './harness-support';

export interface AuditContext {
  authed: boolean;
  bookId: string;
  snap: ServerSnapshot;
  ledger: Map<string, LedgerEntry>;
  serverIdByMutationId: Map<string, string>;
  observedDeletedEntityIds: Set<string>;
  observedDeletedCommentIds: Set<string>;
  lightViolations: string[];
}

/** Reconcile the ledger against decrypted local state and the server snapshot. */
export async function reconcileLedger(ctx: AuditContext): Promise<string[]> {
  const {
    authed,
    bookId,
    snap,
    ledger,
    serverIdByMutationId,
    observedDeletedEntityIds,
    observedDeletedCommentIds,
    lightViolations,
  } = ctx;
  const violations = lightViolations;
  // While logged out the local encrypted stores are intentionally
  // inaccessible (session key gone), so ledger reconciliation cannot read
  // them; checks resume after the next login.
  if (!authed) return violations;
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

  const conflicts = getPendingConflicts(bookId);

  for (const entry of ledger.values()) {
    if (entry.settled) continue;
    const mid = entry.mutationId;
    const queuedItem = queued.get(mid);
    const localAnnotation = annotations.find((a) => a.mutationId === mid);

    if (entry.kind === 'progress') {
      const applied = snap.progressMutations.some((m) => m.mutationId === mid);
      const conflicted = conflicts.some(
        (c) =>
          c.type === ConflictType.ProgressUpdate &&
          fingerprint(c.localVersion) === entry.fingerprint,
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
      violations.push(
        `ledger: progress mutation ${mid} disappeared without trace (not applied, not conflicted, not queued)`,
      );
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
      const superseding = [...ledger.values()].some(
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
      violations.push(
        `ledger: resolve ${mid} target ${entry.serverId} not reflected on server and not queued`,
      );
      continue;
    }

    const row = snap[
      entry.kind === 'highlight'
        ? 'highlights'
        : entry.kind === 'comment'
          ? 'comments'
          : 'bookmarks'
    ].find((r) => r.mutationId === mid);
    if (row) {
      entry.serverId = row.id;
      entry.settled = true;
      entry.stage = 'synced';
      continue;
    }
    const serverId = entry.serverId ?? serverIdByMutationId.get(mid);
    if (serverId && observedDeletedEntityIds.has(serverId)) {
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
    violations.push(
      `ledger: ${entry.kind} mutation ${mid} lost (no server row, no queue item, no failure marker)`,
    );
  }

  // Tombstone stability: a deleted comment must never be resurrected by a
  // stale create replay of the same mutation id. Explicit user resolves on
  // the comment are allowed to revive it (the server contract permits the
  // PATCH and the user acted deliberately).
  for (const deletedId of observedDeletedCommentIds) {
    const row = snap.comments.find((c) => c.id === deletedId);
    if (row && row.status !== 'deleted') {
      const revivedByResolve = [...ledger.values()].some(
        (e) => e.kind === 'resolve' && e.serverId === deletedId && e.targetStatus === row.status,
      );
      if (!revivedByResolve) {
        violations.push(`tombstone resurrected: comment ${deletedId} is ${row.status}`);
      }
    }
  }

  return violations;
}

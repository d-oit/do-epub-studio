import { createTraceId, createSpanId } from '@do-epub-studio/shared';
import { logClientEvent } from '../client-logger';
import { v4 as uuidv4 } from 'uuid';
import { saveConflicts, getAllConflicts } from './db';
import type { ConflictRecord, ConflictType } from './db';

// Canonical conflict record shape + category type live in `db.ts` (the storage
// module owns persisted record shapes); re-export so the public API stays at
// this domain module for all existing importers.
export { ConflictType } from './db';
export type { ConflictRecord } from './db';

export enum ConflictResolutionStrategy {
  LastWriteWins = 'last_write_wins',
  Manual = 'manual',
}

export interface ConflictResolutionResult {
  resolved: boolean;
  strategy: ConflictResolutionStrategy;
  winner: 'local' | 'remote';
  merged?: unknown;
}

const pendingConflicts = new Map<string, ConflictRecord>();

const MANUAL_CONFLICT_THRESHOLD_MS = 5_000;

// The in-memory Map is the synchronous hot store; IndexedDB is the durable
// mirror (Plan 228 F2). Writes are serialized through `writeChain` so a resolve
// followed by a clear cannot race, and failures degrade to a logged warning
// (the in-memory session keeps working).
let hydrationPromise: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function writeThrough(): Promise<void> {
  writeChain = writeChain
    .then(() => saveConflicts([...pendingConflicts.values()]))
    .catch((err) => {
      logClientEvent({
        level: 'warn',
        traceId: createTraceId(),
        spanId: createSpanId(),
        event: 'conflict.persist.failed',
        metadata: { errorMessage: err instanceof Error ? err.message : String(err) },
      });
    });
  return writeChain;
}

/** Test/smoke seam: await all queued writes have settled (deterministic asserts). */
export function flushConflictWrites(): Promise<void> {
  return writeChain;
}

/** Load stored conflicts into the in-memory Map once. A stored record replaces
 *  an in-memory record with the same id; stored records not in the Map are added. */
export function hydrateConflicts(): Promise<void> {
  if (!hydrationPromise) {
    hydrationPromise = getAllConflicts()
      .then((stored) => {
        for (const record of stored) {
          pendingConflicts.set(record.id, record);
        }
      })
      .catch((err) => {
        logClientEvent({
          level: 'warn',
          traceId: createTraceId(),
          spanId: createSpanId(),
          event: 'conflict.hydrate.failed',
          metadata: { errorMessage: err instanceof Error ? err.message : String(err) },
        });
      });
  }
  return hydrationPromise;
}

/** Test-only: clear the in-memory Map WITHOUT writing, simulating a fresh
 *  session so `hydrateConflicts()` re-runs. */
export function __clearConflictCache(): void {
  pendingConflicts.clear();
  hydrationPromise = null;
}

export function detectConflict(
  type: ConflictType,
  localVersion: unknown,
  remoteVersion: unknown,
  localTimestamp: number,
  remoteTimestamp: number,
  bookId: string,
  entityId: string,
): ConflictRecord | null {
  if (localTimestamp === remoteTimestamp) {
    const conflict: ConflictRecord = {
      id: uuidv4(),
      type,
      localVersion,
      remoteVersion,
      localTimestamp,
      remoteTimestamp,
      resolved: false,
      resolution: null,
      resolvedAt: null,
      bookId,
      entityId,
      createdAt: Date.now(),
    };
    pendingConflicts.set(conflict.id, conflict);
    logClientEvent({
      level: 'warn',
      traceId: createTraceId(),
      spanId: createSpanId(),
      event: 'conflict.detected',
      metadata: {
        conflictId: conflict.id,
        type,
        bookId,
        entityId,
      },
    });
    void writeThrough();
    return conflict;
  }
  return null;
}

export function resolveWithLWW(
  type: ConflictType,
  localVersion: unknown,
  remoteVersion: unknown,
  localTimestamp: number,
  remoteTimestamp: number,
): ConflictResolutionResult {
  const winner = localTimestamp >= remoteTimestamp ? 'local' : 'remote';
  const merged = winner === 'local' ? localVersion : remoteVersion;

  logClientEvent({
    level: 'info',
    traceId: createTraceId(),
    spanId: createSpanId(),
    event: 'conflict.resolved.lww',
    metadata: { type, winner, localTimestamp, remoteTimestamp },
  });

  return {
    resolved: true,
    strategy: ConflictResolutionStrategy.LastWriteWins,
    winner,
    merged,
  };
}

export function resolveConflict(
  type: ConflictType,
  localVersion: unknown,
  remoteVersion: unknown,
  localTimestamp: number,
  remoteTimestamp: number,
  bookId: string,
  entityId: string,
): ConflictResolutionResult {
  const timeDiff = Math.abs(localTimestamp - remoteTimestamp);

  if (timeDiff > MANUAL_CONFLICT_THRESHOLD_MS || localTimestamp === remoteTimestamp) {
    const conflict = detectConflict(type, localVersion, remoteVersion, localTimestamp, remoteTimestamp, bookId, entityId);
    if (conflict && localTimestamp === remoteTimestamp) {
      return {
        resolved: false,
        strategy: ConflictResolutionStrategy.Manual,
        winner: 'local',
      };
    }
  }

  return resolveWithLWW(type, localVersion, remoteVersion, localTimestamp, remoteTimestamp);
}

export function getPendingConflicts(bookId?: string): ConflictRecord[] {
  const all = Array.from(pendingConflicts.values()).filter((c) => !c.resolved);
  if (bookId) {
    return all.filter((c) => c.bookId === bookId);
  }
  return all;
}

export function resolveManualConflict(
  conflictId: string,
  resolution: 'local' | 'remote',
  mergedVersion?: unknown,
): ConflictResolutionResult | null {
  const conflict = pendingConflicts.get(conflictId);
  if (!conflict || conflict.resolved) return null;

  conflict.resolved = true;
  conflict.resolution = resolution;
  conflict.resolvedAt = Date.now();

  if (mergedVersion) {
    conflict.localVersion = mergedVersion;
  }

  const winner = resolution;
  const merged = mergedVersion ?? (resolution === 'local' ? conflict.localVersion : conflict.remoteVersion);

  pendingConflicts.set(conflictId, conflict);

  logClientEvent({
    level: 'info',
    traceId: createTraceId(),
    spanId: createSpanId(),
    event: 'conflict.resolved.manual',
    metadata: { conflictId, resolution, type: conflict.type },
  });

  void writeThrough();

  return {
    resolved: true,
    strategy: ConflictResolutionStrategy.Manual,
    winner,
    merged,
  };
}

export function clearResolvedConflicts(bookId?: string): void {
  let purged = false;
  for (const [id, conflict] of pendingConflicts) {
    if (conflict.resolved && (!bookId || conflict.bookId === bookId)) {
      pendingConflicts.delete(id);
      purged = true;
    }
  }
  if (purged) {
    void writeThrough();
  }
}

export function clearAllConflicts(): void {
  const hadEntries = pendingConflicts.size > 0;
  pendingConflicts.clear();
  if (hadEntries) {
    void writeThrough();
  }
}

export function hasPendingConflicts(bookId?: string): boolean {
  return getPendingConflicts(bookId).length > 0;
}

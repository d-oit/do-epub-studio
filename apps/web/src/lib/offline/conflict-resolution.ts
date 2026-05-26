import { createTraceId, createSpanId } from '@do-epub-studio/shared';
import { logClientEvent } from '../client-logger';
import { v4 as uuidv4 } from 'uuid';

export enum ConflictType {
  ProgressUpdate = 'progress_update',
  AnnotationEdit = 'annotation_edit',
  BookmarkChange = 'bookmark_change',
  CommentUpdate = 'comment_update',
}

export enum ConflictResolutionStrategy {
  LastWriteWins = 'last_write_wins',
  Manual = 'manual',
}

export interface ConflictRecord {
  id: string;
  type: ConflictType;
  localVersion: unknown;
  remoteVersion: unknown;
  localTimestamp: number;
  remoteTimestamp: number;
  resolved: boolean;
  resolution: 'local' | 'remote' | null;
  resolvedAt: number | null;
  bookId: string;
  entityId: string;
  createdAt: number;
}

export interface ConflictResolutionResult {
  resolved: boolean;
  strategy: ConflictResolutionStrategy;
  winner: 'local' | 'remote';
  merged?: unknown;
}

const pendingConflicts = new Map<string, ConflictRecord>();

const MANUAL_CONFLICT_THRESHOLD_MS = 5_000;

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

  return {
    resolved: true,
    strategy: ConflictResolutionStrategy.Manual,
    winner,
    merged,
  };
}

export function clearResolvedConflicts(): void {
  for (const [id, conflict] of pendingConflicts) {
    if (conflict.resolved) {
      pendingConflicts.delete(id);
    }
  }
}

export function clearAllConflicts(): void {
  pendingConflicts.clear();
}

export function hasPendingConflicts(bookId?: string): boolean {
  return getPendingConflicts(bookId).length > 0;
}

import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { getProgress, saveProgress } from './db';
import { useAuthStore } from '../../stores/auth';
import { useReaderStore } from '../../stores/reader';
import { queueSync } from './sync';
import { ConflictType, type ConflictRecord } from './conflict-resolution';
import { logClientEvent } from '../client-logger';
import type { ProgressSyncPayload, RemoteProgressVersion } from './progress-conflict';

function parseProgressConflict(
  conflict: ConflictRecord,
): { local: ProgressSyncPayload; remote: RemoteProgressVersion } | null {
  if (conflict.type !== ConflictType.ProgressUpdate) return null;
  const local = conflict.localVersion;
  const remote = conflict.remoteVersion;
  if (
    typeof local !== 'object' ||
    local === null ||
    typeof remote !== 'object' ||
    remote === null ||
    !('bookId' in local) ||
    typeof local.bookId !== 'string' ||
    !('cfi' in local) ||
    typeof local.cfi !== 'string' ||
    !('percentage' in local) ||
    typeof local.percentage !== 'number' ||
    !Number.isFinite(local.percentage) ||
    local.percentage < 0 ||
    local.percentage > 100 ||
    !('mutationId' in local) ||
    typeof local.mutationId !== 'string' ||
    local.mutationId.length === 0 ||
    ('baseRevision' in local &&
      (typeof local.baseRevision !== 'number' ||
        !Number.isInteger(local.baseRevision) ||
        local.baseRevision < 0)) ||
    !('bookId' in remote) ||
    typeof remote.bookId !== 'string' ||
    remote.bookId !== local.bookId ||
    !('cfi' in remote) ||
    typeof remote.cfi !== 'string' ||
    !('percentage' in remote) ||
    typeof remote.percentage !== 'number' ||
    !Number.isFinite(remote.percentage) ||
    remote.percentage < 0 ||
    remote.percentage > 100 ||
    !('revision' in remote) ||
    typeof remote.revision !== 'number' ||
    !Number.isInteger(remote.revision) ||
    remote.revision < 0
  ) {
    return null;
  }

  return {
    local: {
      bookId: local.bookId,
      cfi: local.cfi,
      percentage: local.percentage,
      mutationId: local.mutationId,
      ...('baseRevision' in local && typeof local.baseRevision === 'number'
        ? { baseRevision: local.baseRevision }
        : {}),
      ...('dependsOnMutationId' in local && typeof local.dependsOnMutationId === 'string'
        ? { dependsOnMutationId: local.dependsOnMutationId }
        : {}),
    },
    remote: {
      bookId: remote.bookId,
      cfi: remote.cfi,
      percentage: remote.percentage,
      revision: remote.revision,
      updatedAt:
        'updatedAt' in remote && typeof remote.updatedAt === 'string' ? remote.updatedAt : null,
    },
  };
}

export async function resendProgressFromConflict(conflict: ConflictRecord): Promise<void> {
  const data = parseProgressConflict(conflict);
  if (!data) {
    logClientEvent({
      level: 'warn',
      traceId: createTraceId(),
      spanId: createSpanId(),
      event: 'sync.conflict_resend.skipped_malformed',
      metadata: { conflictId: conflict.id, type: conflict.type },
    });
    return;
  }

  const { local, remote } = data;
  const payload: ProgressSyncPayload = {
    bookId: local.bookId,
    cfi: local.cfi,
    percentage: local.percentage,
    mutationId: local.mutationId,
    baseRevision: remote.revision,
  };
  const storedProgress = await getProgress(local.bookId).catch(() => undefined);
  if (storedProgress?.mutationId === local.mutationId) {
    await saveProgress({
      ...storedProgress,
      cfi: local.cfi,
      percentage: local.percentage,
      baseRevision: remote.revision,
      synced: false,
    });
  }

  const auth = useAuthStore.getState();
  if (auth.bookId === local.bookId) {
    const reader = useReaderStore.getState();
    reader.setProgress({ ...reader.progress, revision: remote.revision });
  }
  await queueSync('progress', payload, local.mutationId);
}

export async function acceptRemoteProgressFromConflict(conflict: ConflictRecord): Promise<void> {
  const data = parseProgressConflict(conflict);
  if (!data) return;

  const { local, remote } = data;
  const storedProgress = await getProgress(remote.bookId).catch(() => undefined);
  if (storedProgress?.mutationId === local.mutationId) {
    await saveProgress({
      ...storedProgress,
      cfi: remote.cfi,
      percentage: remote.percentage,
      lastRead: Date.now(),
      baseRevision: remote.revision,
      synced: true,
    });
  }

  const auth = useAuthStore.getState();
  if (auth.bookId !== remote.bookId) return;

  const reader = useReaderStore.getState();
  const isConflictedPositionVisible =
    reader.progress.locator?.cfi === local.cfi &&
    reader.progress.progressPercent === local.percentage;
  reader.setProgress(
    isConflictedPositionVisible
      ? {
          locator: remote.cfi ? { cfi: remote.cfi } : null,
          progressPercent: remote.percentage,
          updatedAt: remote.updatedAt,
          revision: remote.revision,
        }
      : { ...reader.progress, revision: remote.revision },
  );
}

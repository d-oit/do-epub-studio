import type { SyncQueueItem } from './db';
import { MAX_RETRY_ATTEMPTS } from './sync-policy';

function progressDependency(item: SyncQueueItem): string | null {
  if (item.type !== 'progress' || typeof item.payload !== 'object' || item.payload === null) {
    return null;
  }
  if (
    'dependsOnMutationId' in item.payload &&
    typeof item.payload.dependsOnMutationId === 'string'
  ) {
    return item.payload.dependsOnMutationId;
  }
  return null;
}

export function sortByMutationDependency(queue: SyncQueueItem[]): SyncQueueItem[] {
  const priority = [...queue].sort((a, b) => a.createdAt - b.createdAt);
  const progressByMutationId = new Map(
    priority.filter((item) => item.type === 'progress').map((item) => [item.mutationId, item]),
  );
  const remaining = new Set(priority);
  const ordered: SyncQueueItem[] = [];

  while (remaining.size > 0) {
    let next: SyncQueueItem | undefined;
    for (const candidate of priority) {
      if (!remaining.has(candidate)) continue;
      const dependencyId = progressDependency(candidate);
      const predecessor = dependencyId ? progressByMutationId.get(dependencyId) : undefined;
      if (
        !predecessor ||
        !remaining.has(predecessor) ||
        predecessor.permanentError ||
        predecessor.attempts >= MAX_RETRY_ATTEMPTS
      ) {
        next = candidate;
        break;
      }
    }

    const selected = next ?? priority.find((item) => remaining.has(item));
    if (!selected) break;
    remaining.delete(selected);
    ordered.push(selected);
  }

  return ordered;
}

import { Badge } from './badge';

export type SyncUi = 'online' | 'offline' | 'syncing' | 'queued' | 'conflict';

export function SyncIndicator({
  status,
  queuedCount = 0,
  onConflictClick,
}: {
  status: SyncUi;
  queuedCount?: number;
  onConflictClick?: () => void;
}) {
  const copy = {
    online: null,
    offline: 'Offline — reading cached chapters',
    syncing: 'Saving…',
    queued: `Waiting to sync (${queuedCount})`,
    conflict: 'Annotation conflict — review',
  }[status];

  if (!copy) return null;

  return (
    <button
      type="button"
      onClick={status === 'conflict' ? onConflictClick : undefined}
      className={status === 'conflict' ? 'cursor-pointer' : 'cursor-default'}
    >
      <Badge
        variant={status === 'conflict' ? 'warning' : 'info'}
        aria-live="polite"
      >
        {copy}
      </Badge>
    </button>
  );
}

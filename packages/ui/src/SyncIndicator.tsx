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
      className={`min-h-11 inline-flex items-center touch-target rounded-[var(--radius-paper)] ${
        status === 'conflict' ? 'cursor-pointer active:scale-95 transition-transform' : 'cursor-default'
      }`}
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

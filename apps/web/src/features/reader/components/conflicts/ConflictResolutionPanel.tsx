import { useEffect, useCallback, useRef } from 'react';
import { useReaderStore } from '../../../../stores/reader';
import { useAuthStore } from '../../../../stores';
import { useTranslation, type TFunction } from '../../../../hooks/useTranslation';
import type { TranslationKeys } from '../../../../i18n';
import {
  getPendingConflicts,
  resolveManualConflict,
  clearResolvedConflicts,
  type ConflictRecord,
  type ConflictType,
} from '../../../../lib/offline/conflict-resolution';

const CONFLICT_TYPE_LABELS: Record<ConflictType, TranslationKeys> = {
  progress_update: 'reader.conflicts.type.progress_update',
  annotation_edit: 'reader.conflicts.type.annotation_edit',
  bookmark_change: 'reader.conflicts.type.bookmark_change',
  comment_update: 'reader.conflicts.type.comment_update',
};

const MAX_DIFF_LENGTH = 120;

function formatDiff(value: unknown): string {
  const raw = JSON.stringify(value);
  return raw.length > MAX_DIFF_LENGTH ? `${raw.slice(0, MAX_DIFF_LENGTH)}\u2026` : raw;
}

function ConflictItem({
  conflict,
  t,
  onResolve,
  onDismiss,
}: {
  conflict: ConflictRecord;
  t: TFunction;
  onResolve: (id: string, resolution: 'local' | 'remote') => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <li className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {t(CONFLICT_TYPE_LABELS[conflict.type])}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-foreground-muted font-mono">
        <div className="rounded bg-background-secondary p-2 overflow-hidden">
          <span className="sr-only">{t('reader.conflicts.localLabel')}</span>
          <span aria-hidden="true">{formatDiff(conflict.localVersion)}</span>
        </div>
        <div className="rounded bg-background-secondary p-2 overflow-hidden">
          <span className="sr-only">{t('reader.conflicts.remoteLabel')}</span>
          <span aria-hidden="true">{formatDiff(conflict.remoteVersion)}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onResolve(conflict.id, 'local')}
          className="touch-target rounded-md bg-accent text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`${t('reader.conflicts.keepLocal')} - ${t(CONFLICT_TYPE_LABELS[conflict.type])}`}
        >
          {t('reader.conflicts.keepLocal')}
        </button>
        <button
          type="button"
          onClick={() => onResolve(conflict.id, 'remote')}
          className="touch-target rounded-md bg-background-secondary text-foreground px-3 py-1.5 text-sm font-medium border border-border hover:bg-background-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`${t('reader.conflicts.keepRemote')} - ${t(CONFLICT_TYPE_LABELS[conflict.type])}`}
        >
          {t('reader.conflicts.keepRemote')}
        </button>
        <button
          type="button"
          onClick={() => onDismiss(conflict.id)}
          className="touch-target rounded-md text-foreground-muted px-3 py-1.5 text-sm font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`${t('reader.conflicts.dismiss')} - ${t(CONFLICT_TYPE_LABELS[conflict.type])}`}
        >
          {t('reader.conflicts.dismiss')}
        </button>
      </div>
    </li>
  );
}

export function ConflictResolutionPanel() {
  const { t } = useTranslation();
  const bookId = useAuthStore((s) => s.bookId);
  const conflicts = useReaderStore((s) => s.conflicts);
  const setConflicts = useReaderStore((s) => s.setConflicts);
  const storeResolveConflict = useReaderStore((s) => s.resolveConflict);

  const unresolved = conflicts.filter((c) => !c.resolved);

  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (!bookId || hasSyncedRef.current) return;
    hasSyncedRef.current = true;
    const pending = getPendingConflicts(bookId);
    const existingIds = new Set(conflicts.map((c) => c.id));
    const newConflicts = pending.filter((c) => !existingIds.has(c.id));
    if (newConflicts.length > 0) {
      setConflicts([...conflicts, ...newConflicts]);
    }
  }, [bookId, conflicts, setConflicts]);

  const handleResolve = useCallback(
    (conflictId: string, resolution: 'local' | 'remote') => {
      resolveManualConflict(conflictId, resolution);
      storeResolveConflict(conflictId, resolution);
      if (bookId) clearResolvedConflicts(bookId);
    },
    [storeResolveConflict, bookId],
  );

  const handleDismiss = useCallback(
    (conflictId: string) => {
      storeResolveConflict(conflictId, 'local');
      if (bookId) clearResolvedConflicts(bookId);
    },
    [storeResolveConflict, bookId],
  );

  if (unresolved.length === 0) return null;

  return (
    <section
      aria-live="polite"
      aria-label={t('reader.conflicts.title')}
      className="animate-slide-up-fade"
    >
      <div className="border border-accent-error/30 bg-background rounded-xl shadow-md p-4 mx-4 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          {t('reader.conflicts.summary', { n: unresolved.length })}
        </h2>
        <ul className="space-y-3">
          {unresolved.map((conflict) => (
            <ConflictItem
              key={conflict.id}
              conflict={conflict}
              t={t}
              onResolve={handleResolve}
              onDismiss={handleDismiss}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

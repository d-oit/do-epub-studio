import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  assignCreator,
  fetchCreatorAssignments,
  revokeCreator,
  type CreatorAssignment,
} from '../../lib/api/creator';

interface CreatorAssignmentsSectionProps {
  bookId: string | undefined;
  token: string;
  executeWithStepUp: <T>(fn: (token: string) => Promise<T>, currentToken?: string) => Promise<T>;
}

/** GOAP-999 COL-01: minimal per-book creator assignment UI on the grants page. */
export function CreatorAssignmentsSection({ bookId, token, executeWithStepUp }: CreatorAssignmentsSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState<CreatorAssignment[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bookId || !token) {
      setAssignments([]);
      return;
    }
    try {
      setAssignments(await fetchCreatorAssignments(bookId, token));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [bookId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!bookId) return null;

  const handleAssign = async () => {
    if (!bookId || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await executeWithStepUp(
        (stepUpToken) => assignCreator(bookId, email.trim(), stepUpToken),
        token,
      );
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (targetEmail: string) => {
    if (!bookId) return;
    setBusy(true);
    setError(null);
    try {
      await executeWithStepUp(
        (stepUpToken) => revokeCreator(bookId, targetEmail, stepUpToken),
        token,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={t('creator.assigned')} className="mt-6 rounded-lg border border-[var(--color-rule)] p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">{t('creator.assigned')}</h2>

      {assignments.length > 0 && (
        <ul className="mt-2 space-y-1">
          {assignments.map((a) => (
            <li key={a.email} className="flex items-center justify-between gap-2 text-sm">
              <span>{a.email}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRevoke(a.email)}
                className="text-xs text-foreground-muted underline underline-offset-2 hover:text-foreground disabled:opacity-50"
              >
                {t('creator.revoke')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('creator.assignEmail')}
          aria-label={t('creator.assignEmail')}
          className="min-w-0 flex-1 rounded-lg border border-[var(--color-rule)] bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy || email.trim().length === 0}
          onClick={() => void handleAssign()}
          className="rounded-lg bg-accent px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {t('creator.assign')}
        </button>
      </div>

      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}

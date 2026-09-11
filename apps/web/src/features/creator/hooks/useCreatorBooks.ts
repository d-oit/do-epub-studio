import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../../stores/auth';
import { fetchCreatorBooks, type CreatorBook } from '../../../lib/api/creator';
import { createTraceId } from '@do-epub-studio/shared';
import { logClientEvent } from '../../../lib/client-logger';

const CACHE_KEY = 'do-epub-studio.creator-books';

interface CachedBooks {
  email: string;
  books: CreatorBook[];
  cachedAt: number;
}

function readCache(email: string): CreatorBook[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBooks;
    if (parsed.email !== email) return null;
    return parsed.books;
  } catch {
    return null;
  }
}

function writeCache(email: string, books: CreatorBook[]): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ email, books, cachedAt: Date.now() }));
  } catch {
    // Session storage full or unavailable — the hook refetches instead.
  }
}

/**
 * Assigned creator books for the current session. Cached per session so the
 * shell does not refetch on every mount; the creator pages revalidate.
 * Empty (not an error) means unassigned — callers render the empty state.
 */
export function useCreatorBooks(): {
  books: CreatorBook[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const email = useAuthStore((s) => s.email);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [books, setBooks] = useState<CreatorBook[]>(() => (email ? (readCache(email) ?? []) : []));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionToken || !email) {
      setBooks([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const list = await fetchCreatorBooks(sessionToken);
      setBooks(list);
      writeCache(email, list);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // 403 here means "not a creator" only when the session itself is
      // invalid does the global 401 handling redirect; keep the empty state.
      setError(message);
      logClientEvent({
        level: 'error', traceId: createTraceId(),
        event: 'creator.books.failed',
        error: { name: 'Error', message },
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, email]);

  useEffect(() => {
    if (!isAuthenticated || !email) {
      setBooks([]);
      return;
    }
    // Serve the session cache instantly; revalidate in the background so
    // revocation takes effect without a reload.
    void refresh();
  }, [isAuthenticated, email, refresh]);

  return { books, isLoading, error, refresh };
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../lib/api/index';
import { getBookFile, saveBookFile } from '../../../lib/offline/db';

interface UseBookFileUrlOptions {
  /** Authenticated session token; the effect no-ops until it is present. */
  sessionToken: string | null;
  /** Book slug from the route; used for the login redirect. */
  bookSlug: string | undefined;
  /** Book UUID the reader APIs are addressed by. */
  bookId: string | null;
  /** Message shown when neither the API nor the cached URL can serve the book. */
  unavailableMessage: string;
  /** Called once the book file URL (or a cached fallback) is resolved. */
  onResolved: () => void;
  /** Reports the load state to the caller. */
  onLoadingChange: (loading: boolean) => void;
  /** Reports a terminal failure to the caller. */
  onError: (message: string) => void;
}

interface UseBookFileUrlResult {
  /** Signed file URL to hand to the EPUB loader, or null while unresolved. */
  epubUrl: string | null;
  /** Server file id behind the current URL, for annotation locators. */
  bookFileIdRef: React.MutableRefObject<string | null>;
}

/**
 * Resolves the reader's signed book-file URL.
 *
 * A5 (GOAP-300): a successful response is cached encrypted at rest so an
 * offline reload can still serve the book from the service-worker cache. The
 * cached copy is used **only** while `navigator.onLine` is false — a failed
 * online request (revoked or expired capability) must surface as an error
 * rather than silently reading a stale capability.
 */
export function useBookFileUrl({
  sessionToken,
  bookSlug,
  bookId,
  unavailableMessage,
  onResolved,
  onLoadingChange,
  onError,
}: UseBookFileUrlOptions): UseBookFileUrlResult {
  const navigate = useNavigate();
  const bookFileIdRef = useRef<string | null>(null);
  const [epubUrl, setEpubUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken || !bookSlug) {
      void navigate('/login');
      return;
    }
    const controller = new AbortController();
    let aborted = false;
    onLoadingChange(true);
    const fetchFileUrl = async () => {
      try {
        // Sessions are bound to the book UUID; assertBookAccess compares the
        // URL param against auth.bookId with no slug fallback, so file-url
        // must be addressed by id like every other reader API call.
        const data = await apiRequest<{ url: string; fileId?: string }>(
          `/api/books/${bookId}/file-url`,
          {
            method: 'POST',
            token: sessionToken,
            body: JSON.stringify({}),
            signal: controller.signal,
          },
        );
        bookFileIdRef.current = data.fileId ?? null;
        setEpubUrl(data.url);
        if (bookId) {
          void saveBookFile({
            bookId,
            url: data.url,
            fileId: data.fileId ?? null,
            cachedAt: Date.now(),
          }).catch(() => {
            // Cache write is best-effort; reading must not depend on it.
          });
        }
        onResolved();
      } catch (err) {
        if (aborted || controller.signal.aborted) return;
        // Offline fallback only: a failed online request must surface as an
        // error (revoked/expired capability), never a stale cached read.
        if (!navigator.onLine && bookId) {
          const cached = await getBookFile(bookId);
          if (cached) {
            bookFileIdRef.current = cached.fileId;
            setEpubUrl(cached.url);
            onResolved();
            return;
          }
        }
        onError((err as Error).message || unavailableMessage);
      } finally {
        if (!aborted) {
          onLoadingChange(false);
        }
      }
    };
    void fetchFileUrl();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [
    sessionToken,
    bookSlug,
    bookId,
    navigate,
    onResolved,
    onLoadingChange,
    onError,
    unavailableMessage,
  ]);

  return { epubUrl, bookFileIdRef };
}

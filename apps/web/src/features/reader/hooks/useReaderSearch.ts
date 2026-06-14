import { useState, useEffect, useRef } from 'react';
import type { Book, NavItem } from '@intity/epub-js';
import { logClientEvent } from '../../../lib/client-logger';

export interface SearchResult {
  cfi: string;
  cfiRange: string;
  excerpt: string;
  chapterTitle?: string;
}

interface SpineLike {
  each: (cb: (item: SpineSection) => void) => void;
  get: (cfi: string) => SpineSection | undefined;
}

interface SpineSection {
  load: (loader: unknown) => Promise<void>;
  find: (query: string) => Array<{ cfi: string; excerpt: string }>;
  unload: () => void;
  href: string;
}

interface BookLike extends Pick<Book, 'navigation' | 'load'> {
  spine: SpineLike;
}

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 50;
const MAX_INPUT_LEN = 120;
const MIN_QUERY_LEN = 2;
const SNIPPET_EXCERPT_MAX = 2000;

export function useReaderSearch(book: Book | null, query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim().slice(0, MAX_INPUT_LEN);

    if (!book || trimmed.length < MIN_QUERY_LEN) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);
    const mySeq = ++seqRef.current;
    const timeoutId = setTimeout(() => {
      if (cancelledRef.current || mySeq !== seqRef.current) return;
      const startedAt = Date.now();
      const spine = (book as unknown as { spine: SpineLike }).spine;
      const toc = (book.navigation?.toc as NavItem[] | undefined) ?? [];
      void (async (): Promise<void> => {
        try {
          const searchPromises: Array<Promise<Array<{ cfi: string; excerpt: string }>>> = [];
          spine.each((item) => {
            const loader = book.load.bind(book);
            const p = item
              .load(loader)
              .then(() => {
                const matches = item.find(trimmed);
                item.unload();
                return matches;
              })
              .catch((err: unknown) => {
                const e = err as Error;
                logClientEvent({
                  level: 'warn',
                  event: 'reader-search-section-error',
                  traceId: 'reader-search',
                  error: { name: e.name, message: e.message },
                });
                return [];
              });
            searchPromises.push(p);
          });
          const spineResults = await Promise.all(searchPromises);
          if (cancelledRef.current || mySeq !== seqRef.current) return;
          const allResults = spineResults.flat().slice(0, MAX_RESULTS);

          const processed: SearchResult[] = allResults.map((result) => {
            const item = spine.get(result.cfi);
            return {
              cfi: result.cfi,
              cfiRange: result.cfi,
              excerpt: result.excerpt,
              chapterTitle: findChapterTitle(toc, item?.href),
            };
          });
          setResults(processed);
          logClientEvent({
            level: 'info',
            event: 'reader-search-complete',
            traceId: 'reader-search',
            metadata: {
              queryLength: trimmed.length,
              matches: processed.length,
              ms: Date.now() - startedAt,
            },
          });
        } catch (err) {
          if (cancelledRef.current || mySeq !== seqRef.current) return;
          const e = err as Error;
          const message = e.message || 'Search failed';
          setError(message);
          logClientEvent({
            level: 'error',
            event: 'reader-search-failed',
            traceId: 'reader-search',
            error: { name: e.name, message },
          });
        } finally {
          if (mySeq === seqRef.current) setIsSearching(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => { clearTimeout(timeoutId); };
  }, [book, query]);

  return { results, isSearching, error };
}

export function highlightRanges(
  excerpt: string,
  query: string,
): Array<{ text: string; hit: boolean }> {
  if (!excerpt) return [];
  if (!query) return [{ text: excerpt, hit: false }];

  // Use a literal-substring scan (String.indexOf in a loop) rather than a
  // RegExp constructed from the user's query. The query is untrusted input;
  // we cap the scan to SNIPPET_EXCERPT_MAX characters as a DoS guard
  // (per ADR-034 bounded-input policy).
  const bounded = excerpt.length > SNIPPET_EXCERPT_MAX ? excerpt.slice(0, SNIPPET_EXCERPT_MAX) : excerpt;
  const needle = query.length > SNIPPET_EXCERPT_MAX ? query.slice(0, SNIPPET_EXCERPT_MAX) : query;
  const lowerHaystack = bounded.toLowerCase();
  const lowerNeedle = needle.toLowerCase();

  const ranges: Array<{ start: number; end: number }> = [];
  let from = 0;
  while (from < lowerHaystack.length) {
    const idx = lowerHaystack.indexOf(lowerNeedle, from);
    if (idx < 0) break;
    ranges.push({ start: idx, end: idx + needle.length });
    from = idx + needle.length;
    if (needle.length === 0) break;
  }
  if (ranges.length === 0) return [{ text: bounded, hit: false }];

  const parts: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) {
      parts.push({ text: bounded.slice(cursor, r.start), hit: false });
    }
    parts.push({ text: bounded.slice(r.start, r.end), hit: true });
    cursor = r.end;
  }
  if (cursor < bounded.length) {
    parts.push({ text: bounded.slice(cursor), hit: false });
  }
  return parts;
}

function findChapterTitle(toc: NavItem[], href?: string): string | undefined {
  if (!href) return undefined;
  const cleanHref = href.split('#')[0];
  for (const item of toc) {
    if (item.href && (item.href === href || item.href.split('#')[0] === cleanHref)) {
      return item.label;
    }
    if (item.subitems && item.subitems.length > 0) {
      const found = findChapterTitle(item.subitems, href);
      if (found) return found;
    }
  }
  return undefined;
}

export type { BookLike };

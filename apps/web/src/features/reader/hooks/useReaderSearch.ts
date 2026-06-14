import { useState, useEffect } from 'react';
import type { Book, NavItem } from '@intity/epub-js';
import { matchAllBounded, escapeRegex } from '@do-epub-studio/shared';

export interface SearchResult {
  cfi: string;
  snippet: string;
  chapterTitle?: string;
}

interface SpineItem {
  load: (bookLoad: unknown) => Promise<void>;
  find: (query: string) => Array<{ cfi: string; excerpt: string }>;
  unload: () => void;
  href: string;
}

export function useReaderSearch(book: Book | null, query: string) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!book || !query || query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setIsSearching(true);
      const search = async () => {
        try {
          const searchPromises: Array<Promise<Array<{ cfi: string; excerpt: string }>>> = [];
          // @ts-expect-error - spine is complex in epub.js types
          (book.spine as { each: (cb: (item: SpineItem) => void) => void }).each((item: SpineItem) => {
            searchPromises.push(
              item.load(book.load.bind(book)).then(() => {
                const matches = item.find(query);
                item.unload();
                return matches;
              })
            );
          });

          const spineResults = await Promise.all(searchPromises);
          const allResults = spineResults.flat().slice(0, 50);

          const processedResults = allResults.map((result) => {
            // @ts-expect-error - spine access
            const item = (book.spine as { get: (cfi: string) => SpineItem | undefined }).get(result.cfi);
            const chapterTitle = findChapterTitle(book.navigation.toc, item?.href);

            return {
              cfi: result.cfi,
              snippet: highlightSnippet(result.excerpt, query),
              chapterTitle,
            };
          });

          setResults(processedResults);
        } catch (error) {
          console.error('Search failed', error);
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      };
      void search();
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [book, query]);

  return { results, isSearching };
}

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightSnippet(excerpt: string, query: string): string {
  if (!excerpt) return '';
  const escapedQuery = escapeRegex(query);
  const re = new RegExp(escapedQuery, 'gi');
  // Use a reasonable maxLen for snippet
  const matches = matchAllBounded(re, excerpt, 2000);

  if (matches.length === 0) return escapeHtml(excerpt);

  let lastIndex = 0;
  let highlighted = '';
  for (const match of matches) {
    if (match.index !== undefined) {
      highlighted += escapeHtml(excerpt.slice(lastIndex, match.index));
      highlighted += `<mark>${escapeHtml(match[0])}</mark>`;
      lastIndex = match.index + match[0].length;
    }
  }
  highlighted += escapeHtml(excerpt.slice(lastIndex));
  return highlighted;
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

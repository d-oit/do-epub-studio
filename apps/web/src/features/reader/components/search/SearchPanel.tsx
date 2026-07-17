import { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusTrap, Spinner } from '@do-epub-studio/ui';
import { IconButton } from '../../../../components/ui';
import { useReaderSearch, highlightRanges } from '../../hooks/useReaderSearch';
import type { Book } from '@intity/epub-js';

interface SearchPanelProps {
  isOpen: boolean;
  book: Book | null;
  onClose: () => void;
  onNavigate: (cfi: string) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

const SNIPPET_MAX_CHARS = 240;
const VISIBLE_BUFFER = 10;

function buildSnippet(excerpt: string, query: string): string {
  if (excerpt.length <= SNIPPET_MAX_CHARS) return excerpt;
  const idx = excerpt.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return `${excerpt.slice(0, SNIPPET_MAX_CHARS)}\u2026`;
  const half = Math.floor(SNIPPET_MAX_CHARS / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(excerpt.length, start + SNIPPET_MAX_CHARS);
  const safeStart = Math.max(0, end - SNIPPET_MAX_CHARS);
  return `${safeStart > 0 ? '\u2026' : ''}${excerpt.slice(safeStart, end)}${end < excerpt.length ? '\u2026' : ''}`;
}

interface SnippetPart extends RangePart {
  start: number;
  end: number;
}

type RangePart = { text: string; hit: boolean };

function renderSnippet(
  excerpt: string,
  query: string,
  keyPrefix: string,
): React.ReactNode {
  const safeExcerpt = excerpt;
  const safeQuery = query.trim();
  if (!safeQuery) {
    return <span key={keyPrefix}>{safeExcerpt}</span>;
  }
  const trimmed = buildSnippet(safeExcerpt, safeQuery);
  const parts = withPositions(trimmed, highlightRanges(trimmed, safeQuery));
  return parts.map((p) =>
    p.hit ? (
      <mark
        key={`${keyPrefix}-${p.start}-${p.end}`}
        className="bg-accent-warning/30 text-foreground rounded-sm px-0.5"
      >
        {p.text}
      </mark>
    ) : (
      <span key={`${keyPrefix}-${p.start}-${p.end}`}>{p.text}</span>
    ),
  );
}

function withPositions(excerpt: string, parts: RangePart[]): SnippetPart[] {
  const out: SnippetPart[] = [];
  let cursor = 0;
  for (const p of parts) {
    const idx = excerpt.indexOf(p.text, cursor);
    if (idx < 0) {
      out.push({ ...p, start: cursor, end: cursor + p.text.length });
      cursor += p.text.length;
    } else {
      out.push({ ...p, start: idx, end: idx + p.text.length });
      cursor = idx + p.text.length;
    }
  }
  return out;
}

export function SearchPanel({ isOpen, book, onClose, onNavigate, t }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const { results, isSearching, error } = useReaderSearch(book, query);
  const panelRef = useRef<HTMLDivElement>(null);
  // Search input is the first focusable element; the focus-trap in
  // @do-epub-studio/ui auto-focuses it. We intentionally avoid autoFocus to
  // honor the jsx-a11y/no-autofocus rule.
  const inputRef = useRef<HTMLInputElement>(null);

  useFocusTrap(isOpen, panelRef);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    } else if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const itemHeight = 80;
    const scrollTop = el.scrollTop;
    const viewportHeight = el.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - VISIBLE_BUFFER);
    const end = Math.min(results.length, Math.ceil((scrollTop + viewportHeight) / itemHeight) + VISIBLE_BUFFER);
    setVisibleRange({ start, end });
  }, [results.length]);

  useEffect(() => {
    setVisibleRange({ start: 0, end: Math.min(results.length, 50) });
  }, [results.length]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      data-container-name="search-panel"
      className="cq cq--search-panel fixed inset-y-0 right-0 w-full sm:w-96 glass-panel z-50 border-l border-border shadow-2xl flex flex-col animate-slide-in-right"
      role="search"
      aria-label={t('reader.search')}
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('reader.search')}</h2>
        <IconButton
          onClick={onClose}
          variant="ghost"
          size="sm"
          aria-label={t('a11y.close')}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </IconButton>
      </div>

      <div className="p-4 flex flex-col flex-1 overflow-hidden">
        <div className="relative mb-4">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); }}
            placeholder={t('reader.searchPlaceholder')}
            className="w-full bg-background border border-border rounded-lg px-4 py-2 pr-10 text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            maxLength={120}
            aria-label={t('reader.searchPlaceholder')}
          />
          {isSearching && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2"
              role="status"
              aria-live="polite"
            >
              <Spinner size="sm" />
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-accent-error mb-2" role="alert">
            {error}
          </p>
        )}

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto space-y-2 scrollbar-thin" aria-live="polite">
          {query.trim().length >= 2 ? (
            results.length > 0 ? (
              <>
                <p className="cq-search-result-meta text-xs font-medium text-foreground-muted mb-2 px-1">
                  {t('reader.searchMatches', { n: results.length })}
                </p>
                <div style={{ height: results.length * 80, position: 'relative' }}>
                  {results.slice(visibleRange.start, visibleRange.end).map((result, i) => (
                    <button
                      key={result.cfi}
                      type="button"
                      onClick={() => { onNavigate(result.cfi); }}
                      style={{ position: 'absolute', top: (visibleRange.start + i) * 80, left: 0, right: 0 }}
                      className="w-full text-left p-3 rounded-lg hover:bg-background-secondary transition-colors border border-transparent hover:border-border group focus-visible:ring-2 focus-visible:ring-accent outline-none"
                    >
                    {result.chapterTitle && (
                      <span className="block text-[10px] uppercase tracking-wider font-bold text-accent mb-1">
                        {result.chapterTitle}
                      </span>
                    )}
                    <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                      {renderSnippet(result.excerpt, query, result.cfi)}
                    </p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              !isSearching && (
                <div className="flex flex-col items-center justify-center py-12 text-foreground-muted">
                  <svg
                    className="w-12 h-12 mb-3 opacity-20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p className="text-sm">{t('reader.searchNoResults')}</p>
                </div>
              )
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

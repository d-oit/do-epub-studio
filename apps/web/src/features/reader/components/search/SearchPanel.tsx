import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useFocusTrap } from '@do-epub-studio/ui';
import { useReaderSearch } from '../../hooks/useReaderSearch';
import type { Book } from '@intity/epub-js';

interface SearchPanelProps {
  isOpen: boolean;
  book: Book | null;
  onClose: () => void;
  onNavigate: (cfi: string) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function SearchPanel({ isOpen, book, onClose, onNavigate, t }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const { results, isSearching } = useReaderSearch(book, query);
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(isOpen, panelRef);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div
      ref={panelRef}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full sm:w-96 glass-panel z-50 border-l border-border shadow-2xl flex flex-col"
      role="search"
      aria-label={t('reader.search')}
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('reader.search')}</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-background-secondary rounded-lg transition-colors"
          aria-label={t('a11y.close')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 flex flex-col flex-1 overflow-hidden">
        <div className="relative mb-4">
          <input
            type="text"
            role="searchbox"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('reader.searchPlaceholder')}
            className="w-full bg-background border border-border rounded-lg px-4 py-2 pr-10 text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div
          className="flex-1 overflow-y-auto space-y-2 scrollbar-thin"
          aria-live="polite"
        >
          {query.trim().length >= 2 ? (
            results.length > 0 ? (
              <>
                <p className="text-xs font-medium text-foreground-muted mb-2 px-1">
                  {t('reader.searchMatches', { n: results.length })}
                </p>
                {results.map((result, idx) => (
                  <button
                    key={`${result.cfi}-${idx}`}
                    onClick={() => {
                      onNavigate(result.cfi);
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-background-secondary transition-colors border border-transparent hover:border-border group"
                  >
                    {result.chapterTitle && (
                      <span className="block text-[10px] uppercase tracking-wider font-bold text-accent mb-1">
                        {result.chapterTitle}
                      </span>
                    )}
                    <p
                      className="text-sm text-foreground leading-relaxed line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: result.snippet }}
                    />
                  </button>
                ))}
              </>
            ) : (
              !isSearching && (
                <div className="flex flex-col items-center justify-center py-12 text-foreground-muted">
                  <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm">{t('reader.searchNoResults')}</p>
                </div>
              )
            )
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

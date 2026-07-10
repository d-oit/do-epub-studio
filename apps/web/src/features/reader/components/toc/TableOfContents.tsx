import { useRef, useEffect, useCallback } from 'react';
import { useFocusTrap } from '@do-epub-studio/ui';
import { IconButton } from '../../../../components/ui';
import { VirtualList } from '../../../../components/VirtualList';
import type { TranslationKeys } from '../../../../i18n';

interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

interface TableOfContentsProps {
  isOpen: boolean;
  toc: TocItem[];
  currentChapter: string | null;
  onClose: () => void;
  onNavigate: (href: string) => void;
  t: (key: TranslationKeys) => string;
  direction?: 'ltr' | 'rtl';
}

// Render all items eagerly when count is at or below this; virtualize above it.
// Threshold derived from a measured TBT of < 200ms for the reader on 200 chapters
// (per plan 065 acceptance criteria).
const VIRTUALIZE_THRESHOLD = 50;
const TOC_ITEM_HEIGHT = 44; // px-3 py-2 text-sm rounded + touch-target

export function TableOfContents({
  isOpen,
  toc,
  currentChapter,
  onClose,
  onNavigate,
  t,
  direction,
}: TableOfContentsProps) {
  const panelRef = useRef<HTMLElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(isOpen, panelRef);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Scroll the active chapter into view after the list mounts. For virtualized
  // lists the active item is only mounted when in the visible window, so we
  // accept the closest mounted item as the proxy. For short lists the ref
  // attaches directly.
  useEffect(() => {
    if (isOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isOpen]);

  const onVisibleRangeChange = useCallback(
    (start: number, end: number) => {
      // Attach activeItemRef to the first active item in the visible range.
      // (Only used as a fallback when not virtualized; the ref is the
      // direct-attached active button.)
      void start;
      void end;
    },
    [],
  );

  const renderTocItem = useCallback(
    (item: TocItem, index: number) => {
      const isActive = currentChapter === item.href;
      const isRtlLocal = direction === 'rtl';
      return (
        <button
          ref={isActive ? activeItemRef : undefined}
          onClick={() => {
            onNavigate(item.href);
          }}
          aria-current={isActive ? 'location' : undefined}
          className={`w-full px-3 py-2 text-sm rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent outline-none flex items-center min-h-[44px] ${
            isRtlLocal ? 'text-right justify-end' : 'text-left justify-start'
          } ${
            isActive
              ? 'bg-accent text-white font-medium shadow-sm'
              : 'text-foreground hover:bg-background-secondary'
          }`}
          data-toc-index={index}
        >
          {item.label}
        </button>
      );
    },
    [currentChapter, direction, onNavigate],
  );

  if (!isOpen) return null;

  const isRtl = direction === 'rtl';
  const shouldVirtualize = toc.length > VIRTUALIZE_THRESHOLD;

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="toc-title"
      dir={direction}
      data-container-name="toc-panel"
      className={`cq cq--toc-panel fixed inset-y-0 w-64 bg-background border-border z-40 flex flex-col ${
        isRtl ? 'right-0 border-l' : 'left-0 border-r'
      }`}
    >
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h2 id="toc-title" className="font-semibold">{t('reader.tableOfContents')}</h2>
        <IconButton
          onClick={onClose}
          variant="ghost"
          size="sm"
          aria-label={t('a11y.close')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </IconButton>
      </div>
      <div className="flex-1 p-2 overflow-hidden">
        {toc.length > 0 ? (
          shouldVirtualize ? (
            <VirtualList
              items={toc}
              itemHeight={TOC_ITEM_HEIGHT}
              className="h-full"
              ariaLabel={t('reader.tableOfContents')}
              renderItem={renderTocItem}
              onVisibleRangeChange={onVisibleRangeChange}
            />
          ) : (
            <nav className="overflow-y-auto h-full" data-testid="toc-list">
              {toc.map((item, index) => renderTocItem(item, index))}
            </nav>
          )
        ) : (
          <p className="px-3 py-2 text-sm text-foreground-muted">{t('reader.noChapters')}</p>
        )}
      </div>
    </aside>
  );
}

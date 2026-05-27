import { useRef, useEffect } from 'react';
import { useFocusTrap } from '@do-epub-studio/ui';
import type { TranslationKeys } from '../../../../i18n';

interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

interface TableOfContentsProps {
  isOpen: boolean;
  toc: TocItem[];
  onClose: () => void;
  onNavigate: (href: string) => void;
  t: (key: TranslationKeys) => string;
  direction?: 'ltr' | 'rtl';
}

export function TableOfContents({ isOpen, toc, onClose, onNavigate, t, direction }: TableOfContentsProps) {
  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(isOpen, panelRef);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isRtl = direction === 'rtl';

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="toc-title"
      dir={direction}
      className={`fixed inset-y-0 w-64 bg-background border-border z-40 overflow-y-auto ${
        isRtl ? 'right-0 border-l' : 'left-0 border-r'
      }`}
    >
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h2 id="toc-title" className="font-semibold">{t('reader.tableOfContents')}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-background-secondary rounded"
          aria-label={t('reader.settings.close')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <nav className="p-2">
        {toc.length > 0 ? (
          toc.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                onNavigate(item.href);
              }}
              className={`w-full px-3 py-2 text-sm hover:bg-background-secondary rounded ${
                isRtl ? 'text-right' : 'text-left'
              }`}
            >
              {item.label}
            </button>
          ))
        ) : (
          <p className="px-3 py-2 text-sm text-foreground-muted">{t('reader.noChapters')}</p>
        )}
      </nav>
    </aside>
  );
}

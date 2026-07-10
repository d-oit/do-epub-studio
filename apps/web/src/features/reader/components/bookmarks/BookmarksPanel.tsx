import { useRef, useEffect } from 'react';
import { useFocusTrap } from '@do-epub-studio/ui';
import { IconButton, Tooltip } from '../../../../components/ui';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { Bookmark } from '../../../../stores';

interface BookmarksPanelProps {
  isOpen: boolean;
  bookmarks: Bookmark[];
  onClose: () => void;
  onAddBookmark: () => void;
  onDeleteBookmark: (id: string) => void;
  onNavigate: (bookmark: Bookmark) => void;
}

export function BookmarksPanel({
  isOpen,
  bookmarks,
  onClose,
  onAddBookmark,
  onDeleteBookmark,
  onNavigate,
}: BookmarksPanelProps) {
  const { t } = useTranslation();
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

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookmarks-title"
      data-container-name="bookmarks-panel"
      className="cq cq--bookmarks-panel fixed inset-y-0 right-0 w-80 bg-background border-l border-border z-40 flex flex-col shadow-xl"
    >
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h2 id="bookmarks-title" className="font-semibold">{t('reader.bookmarks.title')}</h2>
        <div className="flex items-center gap-2">
          <Tooltip content={t('reader.bookmarks.addTitle')}>
            <IconButton
              onClick={onAddBookmark}
              variant="ghost"
              size="sm"
              aria-label={t('a11y.add_bookmark')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </IconButton>
          </Tooltip>
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
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {bookmarks.length === 0 ? (
          <p className="text-sm text-foreground-muted text-center py-8">
            {t('reader.bookmarks.empty')}
          </p>
        ) : (
          <div className="space-y-3">
            {bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="cq-bookmark-row p-3 rounded-lg border border-border hover:border-accent transition-colors flex flex-col"
              >
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => { onNavigate(bookmark); }}
                    className="flex-1 text-left focus-visible:ring-2 focus-visible:ring-accent outline-none rounded-md px-1 -mx-1"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {bookmark.label || t('reader.bookmarks.untitled')}
                    </p>
                    <p className="text-xs text-foreground-muted mt-1">
                      {new Date(bookmark.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                  <Tooltip content={t('a11y.delete_bookmark')}>
                    <IconButton
                      onClick={() => { onDeleteBookmark(bookmark.id); }}
                      variant="ghost"
                      size="sm"
                      className="text-foreground-muted hover:text-accent-error transition-colors"
                      aria-label={t('a11y.delete_bookmark')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

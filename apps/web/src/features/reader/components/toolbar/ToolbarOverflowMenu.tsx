import type { KeyboardEvent, RefObject } from 'react';
import { IconButton, Tooltip } from '../../../../components/ui';
import { LocaleSwitcher } from '../../../../components/LocaleSwitcher';
import type { TFn } from './toolbar-types';

interface OverflowMenuProps {
  isMenuOpen: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  capabilities: { canComment?: boolean } | null;
  isFixedLayout: boolean;
  openCommentsCount: number;
  bookmarkCount: number;
  onToggleSearch: () => void;
  onToggleComments: () => void;
  onToggleBookmarks: () => void;
  onToggleInfo: () => void;
  onToggleFixedLayoutControls?: () => void;
  onExportNotes: () => void;
  onToggleSettings: () => void;
  onLogout: () => void;
  onToggleNotifications?: () => void;
  onToggleMenu: () => void;
  t: TFn;
}

export function OverflowMenu({
  isMenuOpen,
  menuRef,
  capabilities,
  isFixedLayout,
  openCommentsCount,
  bookmarkCount,
  onToggleSearch,
  onToggleComments,
  onToggleBookmarks,
  onToggleInfo,
  onToggleFixedLayoutControls,
  onExportNotes,
  onToggleSettings,
  onLogout,
  onToggleNotifications,
  onToggleMenu,
  t,
}: OverflowMenuProps) {
  const close = (action: () => void) => () => {
    action();
    onToggleMenu();
  };

  // WAI-ARIA Menu Button Pattern: arrow-key navigation within role="menu"
  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const current = document.activeElement as HTMLElement;
    const idx = items.indexOf(current);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  return (
    <div className="cq-reader-toolbar-overflow relative" ref={menuRef}>
      <Tooltip content={t('reader.moreOptions')}>
        {/* B8: aria-haspopup="menu" matches the role="menu" popup below */}
        <IconButton
          onClick={onToggleMenu}
          variant="ghost"
          aria-label={t('reader.moreOptions')}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </IconButton>
      </Tooltip>

      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-56 glass-panel rounded-xl shadow-xl border border-border p-2 z-[60] animate-scale-in">
          {/* B8: role="menu" + arrow-key navigation per WAI-ARIA Menu Button Pattern */}
          <div role="menu" className="flex flex-col gap-1" onKeyDown={handleMenuKeyDown}>
            <button
              role="menuitem"
              onClick={close(onToggleSearch)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
            >
              <svg
                className="w-4 h-4"
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
              {t('reader.search')}
            </button>
            {capabilities?.canComment && (
              <button
                type="button"
                role="menuitem"
                onClick={close(onToggleComments)}
                className="flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
                aria-label={
                  openCommentsCount > 0
                    ? t('annotation.comment_with_count', { count: openCommentsCount })
                    : t('annotation.comment')
                }
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <span aria-hidden="true">{t('annotation.comment')}</span>
                </div>
                {openCommentsCount > 0 && (
                  <span
                    className="w-5 h-5 bg-primary-700 text-background text-[10px] rounded-full flex items-center justify-center font-bold"
                    aria-hidden="true"
                  >
                    {openCommentsCount}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={close(onToggleNotifications ?? (() => {}))}
              className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                />
              </svg>
              {t('notifications.title')}
            </button>
            <button
              role="menuitem"
              onClick={close(onToggleBookmarks)}
              className="flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
              aria-label={
                bookmarkCount > 0
                  ? t('reader.bookmarks_with_count', { count: bookmarkCount })
                  : t('reader.bookmarks')
              }
            >
              <div className="flex items-center gap-3">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                <span aria-hidden="true">{t('reader.bookmarks')}</span>
              </div>
              {bookmarkCount > 0 && (
                <span
                  className="w-5 h-5 bg-primary-700 text-background text-[10px] rounded-full flex items-center justify-center font-bold"
                  aria-hidden="true"
                >
                  {bookmarkCount}
                </span>
              )}
            </button>
            <button
              role="menuitem"
              onClick={close(onToggleInfo)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {t('reader.aboutBook')}
            </button>
            {isFixedLayout && onToggleFixedLayoutControls && (
              <button
                type="button"
                role="menuitem"
                onClick={close(onToggleFixedLayoutControls)}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
                {t('reader.fixedLayout.title')}
              </button>
            )}
            <button
              role="menuitem"
              onClick={close(onExportNotes)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {t('reader.exportNotes')}
            </button>
            <button
              role="menuitem"
              onClick={close(onToggleSettings)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {t('reader.settings')}
            </button>
            <div className="h-px bg-border my-1" />
            <div className="px-3 py-2">
              <LocaleSwitcher />
            </div>
            <div className="h-px bg-border my-1" />
            <button
              role="menuitem"
              onClick={close(onLogout)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-accent-error hover:bg-accent-error/10 rounded-lg transition-colors text-left"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              {t('reader.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

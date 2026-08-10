import { useState, useRef, useEffect, useMemo } from 'react';
import { useKeyboardShortcut } from '../../../../hooks/useKeyboardShortcut';
import {
  Header,
  IconButton,
  Button,
  Tooltip,
} from '../../../../components/ui';
import { useFocusTrap } from '@do-epub-studio/ui';
import { LocaleSwitcher } from '../../../../components/LocaleSwitcher';
import { useScrollDirection } from '../../../../hooks/useScrollDirection';
import { useReaderStore } from '../../../../stores/reader';
import type { Comment, Bookmark } from '../../../../stores/reader';
import type { TranslationKeys } from '../../../../i18n';

import type { ReaderPanel } from '../../hooks/useReaderUi';
import type { TocItem } from '../../lib/epub-init';

interface ReaderToolbarProps {
  bookTitle: string | null;
  bookSlug: string;
  comments: Comment[];
  bookmarks: Bookmark[];
  capabilities: { canComment?: boolean } | null;
  activePanel: ReaderPanel;
  isFixedLayout?: boolean;
  toc: TocItem[];
  currentChapter: string | null;
  onToggleToc: () => void;
  onToggleSearch: () => void;
  onToggleComments: () => void;
  onToggleBookmarks: () => void;
  onToggleSettings: () => void;
  onToggleInfo: () => void;
  onToggleFixedLayoutControls?: () => void;
  onExportNotes: () => void;
  onLogout: () => void;
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
}

type TFn = (key: TranslationKeys, params?: Record<string, string | number>) => string;

// ─── Left section: TOC toggle + book title + progress ───────────────────────

interface ToolbarLeftProps {
  bookTitle: string | null;
  progressPercent: number;
  isOffline: boolean;
  pendingSyncCount: number;
  chapterProgressLabel: string | null;
  onToggleToc: () => void;
  activePanel: ReaderPanel;
  t: TFn;
}

function ToolbarLeft({
  bookTitle,
  progressPercent,
  isOffline,
  pendingSyncCount,
  chapterProgressLabel,
  onToggleToc,
  activePanel,
  t,
}: ToolbarLeftProps) {
  return (
    <div className="flex items-center gap-4">
      <Tooltip content={t('reader.tableOfContents')}>
        <IconButton
          onClick={onToggleToc}
          variant="ghost"
          aria-label={t('reader.tableOfContents')}
          aria-expanded={activePanel === 'toc'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </IconButton>
      </Tooltip>
      <div className="flex flex-col">
        <h1 className="text-sm font-semibold text-foreground truncate max-w-[150px] sm:max-w-[300px]">
          {bookTitle || t('reader.untitledBook')}
        </h1>
        <div className="flex items-center gap-2">
          {/* C3: Visual mini progress bar is decorative — full progressbar below carries a11y value */}
          <div className="w-24 h-1 bg-border rounded-full overflow-hidden" aria-hidden="true">
            <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="text-[10px] text-foreground-muted font-medium">{Math.round(progressPercent)}%</span>
          {isOffline && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-warning/15 text-accent-warning text-[10px] font-medium"
              role="status"
              aria-live="polite"
            >
              {t('offline.indicator')}
              {pendingSyncCount > 0 && <span className="text-[9px]">({pendingSyncCount})</span>}
            </span>
          )}
        </div>
        {chapterProgressLabel && (
          <span className="text-[10px] text-foreground-muted font-medium" role="status" aria-live="polite">
            {chapterProgressLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Desktop action buttons (right section) ──────────────────────────────────

interface ToolbarActionsProps {
  capabilities: { canComment?: boolean } | null;
  activePanel: ReaderPanel;
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
  t: TFn;
}

function ToolbarActions({
  capabilities,
  activePanel,
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
  t,
}: ToolbarActionsProps) {
  return (
    <div className="cq-reader-toolbar-actions items-center gap-1">
      <Tooltip content={t('reader.search')}>
        <IconButton onClick={onToggleSearch} variant="ghost" aria-label={t('reader.search')} aria-expanded={activePanel === 'search'}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </IconButton>
      </Tooltip>
      {capabilities?.canComment && (
        <Tooltip content={t('annotation.comment')}>
          <IconButton
            onClick={onToggleComments}
            variant="ghost"
            aria-label={openCommentsCount > 0 ? t('annotation.comment_with_count', { count: openCommentsCount }) : t('annotation.comment')}
            aria-expanded={activePanel === 'comments'}
            className="relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {openCommentsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold" aria-hidden="true">
                {openCommentsCount}
              </span>
            )}
          </IconButton>
        </Tooltip>
      )}
      <Tooltip content={t('reader.bookmarks')}>
        <IconButton
          onClick={onToggleBookmarks}
          variant="ghost"
          aria-label={bookmarkCount > 0 ? t('reader.bookmarks_with_count', { count: bookmarkCount }) : t('reader.bookmarks')}
          aria-expanded={activePanel === 'bookmarks'}
          className="relative"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          {bookmarkCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold" aria-hidden="true">
              {bookmarkCount}
            </span>
          )}
        </IconButton>
      </Tooltip>
      <Tooltip content={t('reader.aboutBook')}>
        <IconButton onClick={onToggleInfo} variant="ghost" aria-label={t('reader.aboutBook')} aria-expanded={activePanel === 'info'}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </IconButton>
      </Tooltip>
      {isFixedLayout && onToggleFixedLayoutControls && (
        <Tooltip content={t('reader.fixedLayout.title')}>
          <IconButton onClick={onToggleFixedLayoutControls} variant="ghost" aria-label={t('reader.fixedLayout.title')} aria-expanded={activePanel === 'fl-controls'}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </IconButton>
        </Tooltip>
      )}
      <Tooltip content={t('reader.exportNotes')}>
        <IconButton onClick={onExportNotes} variant="ghost" aria-label={t('reader.exportNotes')}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </IconButton>
      </Tooltip>
      <Tooltip content={t('reader.settings')}>
        <IconButton onClick={onToggleSettings} variant="ghost" aria-label={t('reader.settings')} aria-expanded={activePanel === 'settings'}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </IconButton>
      </Tooltip>
      <div className="mx-1 h-6 w-px bg-border cq-reader-toolbar-divider" />
      <LocaleSwitcher />
      <Button onClick={onLogout} variant="ghost" size="sm">
        {t('reader.signOut')}
      </Button>
    </div>
  );
}

// ─── Mobile overflow menu ────────────────────────────────────────────────────

interface OverflowMenuProps {
  isMenuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
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
  onToggleMenu: () => void;
  t: TFn;
}

function OverflowMenu({
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
  onToggleMenu,
  t,
}: OverflowMenuProps) {
  const close = (action: () => void) => () => { action(); onToggleMenu(); };

  return (
    <div className="cq-reader-toolbar-overflow relative" ref={menuRef}>
      <Tooltip content={t('reader.moreOptions')}>
        {/* B8: aria-haspopup="menu" matches the role="menu" popup below */}
        <IconButton onClick={onToggleMenu} variant="ghost" aria-label={t('reader.moreOptions')} aria-expanded={isMenuOpen} aria-haspopup="menu">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </IconButton>
      </Tooltip>

      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-56 glass-panel rounded-xl shadow-xl border border-border p-2 z-[60] animate-scale-in">
          {/* B8: role="menu" matches aria-haspopup="menu" on the trigger button */}
          <div role="menu" className="flex flex-col gap-1">
            <button role="menuitem" onClick={close(onToggleSearch)} className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {t('reader.search')}
            </button>
            {capabilities?.canComment && (
              <button type="button" role="menuitem" onClick={close(onToggleComments)} className="flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {/* B11: count expressed in accessible label on the button */}
                  <span aria-label={openCommentsCount > 0 ? t('annotation.comment_with_count', { count: openCommentsCount }) : undefined}>
                    {t('annotation.comment')}
                  </span>
                </div>
                {openCommentsCount > 0 && (
                  <span className="w-5 h-5 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold" aria-hidden="true">{openCommentsCount}</span>
                )}
              </button>
            )}
            <button role="menuitem" onClick={close(onToggleBookmarks)} className="flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left">
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {/* B11: count expressed in accessible label on the button */}
                <span aria-label={bookmarkCount > 0 ? t('reader.bookmarks_with_count', { count: bookmarkCount }) : undefined}>
                  {t('reader.bookmarks')}
                </span>
              </div>
              {bookmarkCount > 0 && (
                <span className="w-5 h-5 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold" aria-hidden="true">{bookmarkCount}</span>
              )}
            </button>
            <button role="menuitem" onClick={close(onToggleInfo)} className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('reader.aboutBook')}
            </button>
            {isFixedLayout && onToggleFixedLayoutControls && (
              <button type="button" role="menuitem" onClick={close(onToggleFixedLayoutControls)} className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                {t('reader.fixedLayout.title')}
              </button>
            )}
            <button role="menuitem" onClick={close(onExportNotes)} className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('reader.exportNotes')}
            </button>
            <button role="menuitem" onClick={close(onToggleSettings)} className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t('reader.settings')}
            </button>
            <div className="h-px bg-border my-1" />
            <div className="px-3 py-2"><LocaleSwitcher /></div>
            <div className="h-px bg-border my-1" />
            <button role="menuitem" onClick={close(onLogout)} className="flex items-center gap-3 px-3 py-2 text-sm text-accent-error hover:bg-accent-error/10 rounded-lg transition-colors text-left">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('reader.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main toolbar orchestrator ───────────────────────────────────────────────

export function ReaderToolbar({
  bookTitle,
  comments,
  bookmarks,
  capabilities,
  activePanel,
  isFixedLayout = false,
  toc,
  currentChapter,
  onToggleToc,
  onToggleSearch,
  onToggleComments,
  onToggleBookmarks,
  onToggleSettings,
  onToggleInfo,
  onToggleFixedLayoutControls,
  onExportNotes,
  onLogout,
  t,
}: ReaderToolbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isMenuOpen, menuRef);

  const scrollDirection = useScrollDirection();
  const progressPercent = useReaderStore((s) => s.progress.progressPercent);
  const isOffline = useReaderStore((s) => s.isOffline);
  const pendingSyncCount = useReaderStore((s) => s.pendingSyncCount);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useKeyboardShortcut('Escape', () => setIsMenuOpen(false), { enabled: isMenuOpen });

  const openCommentsCount = useMemo(() => comments.filter((c) => c.status === 'open').length, [comments]);
  const isHeaderVisible = scrollDirection === 'up';

  const chapterProgressLabel = useMemo(() => {
    if (!currentChapter || toc.length === 0) return null;
    const idx = toc.findIndex((item) => item.href === currentChapter);
    if (idx === -1) return null;
    return t('reader.chapterProgress', { current: idx + 1, total: toc.length });
  }, [toc, currentChapter, t]);

  const sharedActionProps = {
    capabilities,
    isFixedLayout,
    openCommentsCount,
    bookmarkCount: bookmarks.length,
    onToggleSearch,
    onToggleComments,
    onToggleBookmarks,
    onToggleInfo,
    onToggleFixedLayoutControls,
    onExportNotes,
    onToggleSettings,
    onLogout,
    t,
  };

  return (
    <Header
      sticky
      aria-hidden={isHeaderVisible ? undefined : true}
      inert={isHeaderVisible ? undefined : true}
      data-container-name="reader-toolbar" /* eslint-disable-line i18next/no-literal-string -- internal container identifier */
      className={`cq cq--reader-toolbar transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full pointer-events-none'}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <ToolbarLeft
            bookTitle={bookTitle}
            progressPercent={progressPercent}
            isOffline={isOffline}
            pendingSyncCount={pendingSyncCount}
            chapterProgressLabel={chapterProgressLabel}
            onToggleToc={onToggleToc}
            activePanel={activePanel}
            t={t}
          />
          <ToolbarActions activePanel={activePanel} {...sharedActionProps} />
          <OverflowMenu
            isMenuOpen={isMenuOpen}
            menuRef={menuRef}
            onToggleMenu={() => setIsMenuOpen((v) => !v)}
            {...sharedActionProps}
          />
        </div>
      </div>
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
          role="progressbar"
          aria-label={t('a11y.reading_progress')}
          aria-valuenow={Math.round(progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </Header>
  );
}

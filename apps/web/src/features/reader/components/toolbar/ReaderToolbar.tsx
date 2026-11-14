import { useState, useRef, useEffect, useMemo } from 'react';
import { useKeyboardShortcut } from '../../../../hooks/useKeyboardShortcut';
import { Header, IconButton, Tooltip } from '../../../../components/ui';
import { useFocusTrap } from '@do-epub-studio/ui';
import { useScrollDirection } from '../../../../hooks/useScrollDirection';
import { useReaderStore } from '../../../../stores/reader';
import type { Comment, Bookmark } from '../../../../stores/reader';
import type { TranslationKeys } from '../../../../i18n';

import type { ReaderPanel } from '../../hooks/useReaderUi';
import type { TocItem } from '../../lib/epub-init';
import { ExportFormatDialog, type ReaderExportFormat } from './ExportFormatDialog';
import { useExportOnlineFile } from '../../hooks/useExportOnlineFile';

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
  onToggleNotifications?: () => void;
  hasMediaOverlays?: boolean;
  isMediaOverlayActive?: boolean;
  onToggleMediaOverlay?: () => void;
  renditions?: RenditionItem[];
  activeRendition?: RenditionItem | null;
  onSelectRendition?: (fullPath: string) => void;
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
}

import { OverflowMenu } from './ToolbarOverflowMenu';
import type { RenditionItem } from '@do-epub-studio/reader-core';
import type { TFn } from './toolbar-types';
import { ToolbarActions } from './ToolbarActions';

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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </IconButton>
      </Tooltip>
      <div className="flex flex-col">
        <h1 className="font-display tracking-tight text-sm font-semibold text-foreground truncate max-w-[150px] sm:max-w-[300px]">
          {bookTitle || t('reader.untitledBook')}
        </h1>
        <div className="flex items-center gap-2">
          {/* C3: Visual mini progress bar is decorative — full progressbar below carries a11y value */}
          <div className="w-24 h-1 bg-border rounded-full overflow-hidden" aria-hidden="true">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-foreground-muted font-medium">
            {Math.round(progressPercent)}%
          </span>
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
          <span
            className="text-[10px] text-foreground-muted font-medium"
            role="status"
            aria-live="polite"
          >
            {chapterProgressLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Mobile overflow menu ────────────────────────────────────────────────────

// ─── Main toolbar orchestrator ───────────────────────────────────────────────

function useReaderToolbarState(
  comments: Comment[],
  toc: TocItem[],
  currentChapter: string | null,
  t: TFn,
) {
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

  const openCommentsCount = useMemo(
    () => comments.filter((c) => c.status === 'open').length,
    [comments],
  );
  const isHeaderVisible = scrollDirection === 'up';

  const chapterProgressLabel = useMemo(() => {
    if (!currentChapter || toc.length === 0) return null;
    const idx = toc.findIndex((item) => item.href === currentChapter);
    if (idx === -1) return null;
    return t('reader.chapterProgress', { current: idx + 1, total: toc.length });
  }, [toc, currentChapter, t]);

  return {
    isMenuOpen,
    setIsMenuOpen,
    menuRef,
    progressPercent,
    isOffline,
    pendingSyncCount,
    openCommentsCount,
    isHeaderVisible,
    chapterProgressLabel,
  };
}

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
  onToggleNotifications,
  hasMediaOverlays,
  isMediaOverlayActive,
  onToggleMediaOverlay,
  renditions,
  activeRendition,
  onSelectRendition,
  t,
}: ReaderToolbarProps) {
  const {
    isMenuOpen,
    setIsMenuOpen,
    menuRef,
    progressPercent,
    isOffline,
    pendingSyncCount,
    openCommentsCount,
    isHeaderVisible,
    chapterProgressLabel,
  } = useReaderToolbarState(comments, toc, currentChapter, t);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const { isExporting, hasError, clearError, downloadOnlineExport } = useExportOnlineFile();
  const openExportDialog = () => {
    clearError();
    setIsExportDialogOpen(true);
  };
  const handleExportFormat = async (format: ReaderExportFormat) => {
    if (format === 'markdown') {
      onExportNotes();
      setIsExportDialogOpen(false);
      return;
    }
    if (await downloadOnlineExport(format)) setIsExportDialogOpen(false);
  };

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
    onExportNotes: openExportDialog,
    onToggleSettings,
    onLogout,
    onToggleNotifications,
    hasMediaOverlays,
    isMediaOverlayActive,
    onToggleMediaOverlay,
    renditions,
    activeRendition,
    onSelectRendition,
    t,
  };

  return (
    <>
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
              onToggleMenu={() => {
                const opening = !isMenuOpen;
                setIsMenuOpen((v) => !v);
                if (opening) {
                  requestAnimationFrame(() => {
                    // eslint-disable-next-line i18next/no-literal-string -- ARIA role selector, not user-visible text
                    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
                    first?.focus();
                  });
                }
              }}
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
      <ExportFormatDialog
        isOpen={isExportDialogOpen}
        isOffline={isOffline}
        isExporting={isExporting}
        hasError={hasError}
        onClose={() => setIsExportDialogOpen(false)}
        onSelect={(format) => {
          void handleExportFormat(format);
        }}
        t={t}
      />
    </>
  );
}

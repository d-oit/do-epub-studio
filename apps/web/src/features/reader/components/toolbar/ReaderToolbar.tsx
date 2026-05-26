import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Header,
  IconButton,
  Button,
  Tooltip,
  scaleVariants,
} from '../../../../components/ui';
import { useFocusTrap } from '@do-epub-studio/ui';
import { LocaleSwitcher } from '../../../../components/LocaleSwitcher';
import { useScrollDirection } from '../../../../hooks/useScrollDirection';
import { useReaderStore } from '../../../../stores/reader';
import type { Comment, Bookmark } from '../../../../stores/reader';
import type { TranslationKeys } from '../../../../i18n';

import { ReaderPanel } from '../../hooks/useReaderUi';

interface ReaderToolbarProps {
  bookTitle: string | null;
  bookSlug: string;
  comments: Comment[];
  bookmarks: Bookmark[];
  capabilities: { canComment?: boolean } | null;
  activePanel: ReaderPanel;
  onToggleToc: () => void;
  onToggleComments: () => void;
  onToggleBookmarks: () => void;
  onToggleSettings: () => void;
  onToggleInfo: () => void;
  onExportNotes: () => void;
  onLogout: () => void;
  t: (key: TranslationKeys) => string;
}

export function ReaderToolbar({
  bookTitle,
  comments,
  bookmarks,
  capabilities,
  activePanel,
  onToggleToc,
  onToggleComments,
  onToggleBookmarks,
  onToggleSettings,
  onToggleInfo,
  onExportNotes,
  onLogout,
  t,
}: ReaderToolbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isMenuOpen, menuRef);

  const scrollDirection = useScrollDirection();
  const progressPercent = useReaderStore((s) => s.progress.progressPercent);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMenuOpen]);

  const openCommentsCount = comments.filter((c) => c.status === 'open').length;
  const isHeaderVisible = scrollDirection === 'up';

  return (
    <Header
      sticky
      animate={{ y: isHeaderVisible ? 0 : 'var(--motion-header-offset)' }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden={isHeaderVisible ? undefined : true}
      className={isHeaderVisible ? '' : 'pointer-events-none'}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center gap-4">
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
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold text-foreground truncate max-w-[150px] sm:max-w-[300px]">
                {bookTitle || t('reader.untitledBook')}
              </h1>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1 bg-border rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-[10px] text-foreground-muted font-medium">
                  {Math.round(progressPercent)}%
                </span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1">
            {capabilities?.canComment && (
              <Tooltip content={t('annotation.comment')}>
                <IconButton
                  onClick={onToggleComments}
                  variant="ghost"
                  aria-label={t('annotation.comment')}
                  aria-expanded={activePanel === 'comments'}
                  className="relative"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  {openCommentsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold">
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
                aria-label={t('reader.bookmarks')}
                aria-expanded={activePanel === 'bookmarks'}
                className="relative"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                {bookmarks.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {bookmarks.length}
                  </span>
                )}
              </IconButton>
            </Tooltip>
            <Tooltip content={t('reader.aboutBook')}>
              <IconButton
                onClick={onToggleInfo}
                variant="ghost"
                aria-label={t('reader.aboutBook')}
                aria-expanded={activePanel === 'info'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </IconButton>
            </Tooltip>
            <Tooltip content={t('reader.exportNotes')}>
              <IconButton onClick={onExportNotes} variant="ghost" aria-label={t('reader.exportNotes')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </IconButton>
            </Tooltip>
            <Tooltip content={t('reader.settings')}>
              <IconButton
                onClick={onToggleSettings}
                variant="ghost"
                aria-label={t('reader.settings')}
                aria-expanded={activePanel === 'settings'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              </IconButton>
            </Tooltip>
            <div className="mx-1 h-6 w-px bg-border hidden md:block" />
            <LocaleSwitcher />
            <Button onClick={onLogout} variant="ghost" size="sm">
              {t('reader.signOut')}
            </Button>
          </div>

          {/* Mobile overflow menu */}
          <div className="sm:hidden relative" ref={menuRef}>
            <IconButton
              onClick={() => { setIsMenuOpen(!isMenuOpen); }}
              variant="ghost"
              aria-label={t('reader.moreOptions')}
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </IconButton>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={scaleVariants}
                  className="absolute right-0 mt-2 w-56 glass-panel rounded-xl shadow-xl border border-border p-2 z-[60]"
                >
                  <div className="flex flex-col gap-1">
                    {capabilities?.canComment && (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleComments();
                          setIsMenuOpen(false);
                        }}
                        className="flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                          </svg>
                          {t('annotation.comment')}
                        </div>
                        {openCommentsCount > 0 && (
                          <span className="w-5 h-5 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                            {openCommentsCount}
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onToggleBookmarks();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                          />
                        </svg>
                        {t('reader.bookmarks')}
                      </div>
                      {bookmarks.length > 0 && (
                        <span className="w-5 h-5 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                          {bookmarks.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        onToggleInfo();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('reader.aboutBook')}
                    </button>
                    <button
                      onClick={() => {
                        onExportNotes();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      onClick={() => {
                        onToggleSettings();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-background-secondary rounded-lg transition-colors text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      onClick={() => {
                        onLogout();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-accent-error hover:bg-accent-error/10 rounded-lg transition-colors text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Header>
  );
}

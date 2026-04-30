import { Header, IconButton, Button, Tooltip } from '../../../../components/ui';
import { LocaleSwitcher } from '../../../../components/LocaleSwitcher';
import type { Bookmark, Comment } from '../../../../stores';

interface ReaderToolbarProps {
  bookTitle: string | null | undefined;
  bookSlug: string;
  comments: Comment[];
  bookmarks: Bookmark[];
  capabilities: { canComment?: boolean; canHighlight?: boolean } | null;
  onToggleToc: () => void;
  onToggleComments: () => void;
  onToggleBookmarks: () => void;
  onToggleSettings: () => void;
  onExportNotes: () => void;
  onLogout: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string) => any;
}

export function ReaderToolbar({
  bookTitle,
  bookSlug,
  comments,
  bookmarks,
  capabilities,
  onToggleToc,
  onToggleComments,
  onToggleBookmarks,
  onToggleSettings,
  onExportNotes,
  onLogout,
  t,
}: ReaderToolbarProps) {
  // showComments, showBookmarks, showSettings are passed but not used in toolbar
  // They could be used for future active state indication
  const openCommentsCount = comments.filter((c) => c.status === 'open').length;

  return (
    <Header className="fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between w-full px-2 md:px-4">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <Tooltip content={t('reader.tableOfContents')}>
            <IconButton
              onClick={onToggleToc}
              variant="ghost"
              aria-label={t('reader.tableOfContents')}
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
          <h1 className="font-medium truncate max-w-50 md:max-w-xs text-foreground">
            {bookTitle || bookSlug}
          </h1>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {capabilities?.canComment && (
            <Tooltip content={t('annotation.comment')}>
              <IconButton
                onClick={onToggleComments}
                variant="ghost"
                className="relative"
                aria-label={t('annotation.comment')}
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
                  <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {openCommentsCount}
                  </span>
                )}
              </IconButton>
            </Tooltip>
          )}
          <Tooltip content="View bookmarks">
            <IconButton
              onClick={onToggleBookmarks}
              variant="ghost"
              className="relative"
              aria-label="Bookmarks"
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
                <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {bookmarks.length}
                </span>
              )}
            </IconButton>
          </Tooltip>
          <Tooltip content="Export highlights and comments as Markdown">
            <IconButton onClick={onExportNotes} variant="ghost" aria-label="Export notes">
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
          <Button onClick={onLogout} variant="ghost" size="sm" className="hidden sm:inline-flex">
            {t('reader.signOut')}
          </Button>
        </div>
      </div>
    </Header>
  );
}

import { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useParams, useNavigate } from 'react-router-dom';
import { Rendition } from '@intity/epub-js';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { fetchHighlights, fetchComments } from '../../lib/api/annotations';
import { useAuthStore, useReaderStore, usePreferencesStore } from '../../stores';
import { setupOnlineListener } from '../../lib/offline';
import { setupZombieDetection } from '../../lib/offline/permissions';
import { AnnotationToolbar, extractSelectionData, CommentsPanel } from './components/annotations';
import {
  renderHighlightsOnRendition,
  renderCommentMarkersOnRendition,
} from './annotationRendering';
import {
  useReaderUI,
  useReaderEpub,
  useAnnotationHandlers,
  useBookmarkHandlers,
  useExportNotes,
  useKeyboardShortcuts,
} from './hooks';
import { AnimatePresence } from 'framer-motion';
import {
  ReaderToolbar,
  ReaderSettingsPanel,
  TableOfContents,
  BookmarksPanel,
  ReaderViewer,
  CommentInputModal,
  KeyboardShortcutsModal,
} from './components';

export function ReaderPage() {
  const { bookSlug } = useParams<{ bookSlug: string }>();
  const navigate = useNavigate();

  // useAuthStore atomic selectors
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const bookId = useAuthStore((s) => s.bookId);
  const bookTitle = useAuthStore((s) => s.bookTitle);
  const capabilities = useAuthStore(useShallow((s) => s.capabilities));
  const logout = useAuthStore((s) => s.logout);

  const {
    activePanel,
    setActivePanel,
    togglePanel,
    isCommentMode,
    setIsCommentMode,
    showCommentInput,
    setShowCommentInput,
    selection,
    setSelection,
    revokedBooks,
    setRevokedBooks,
  } = useReaderUI();

  // useReaderStore atomic selectors
  const setError = useReaderStore((s) => s.setError);
  const error = useReaderStore((s) => s.error);
  const setOffline = useReaderStore((s) => s.setOffline);
  const setPermissionStatus = useReaderStore((s) => s.setPermissionStatus);
  const highlights = useReaderStore(useShallow((s) => s.highlights));
  const setHighlights = useReaderStore((s) => s.setHighlights);
  const comments = useReaderStore(useShallow((s) => s.comments));
  const setComments = useReaderStore((s) => s.setComments);
  const bookmarks = useReaderStore(useShallow((s) => s.bookmarks));
  const currentChapter = useReaderStore((s) => s.currentChapter);

  // usePreferencesStore atomic selectors
  const readerTheme = usePreferencesStore((s) => s.reader.theme);
  const readerFontSize = usePreferencesStore((s) => s.reader.fontSize);
  const readerFontFamily = usePreferencesStore((s) => s.reader.fontFamily);
  const readerPageWidth = usePreferencesStore((s) => s.reader.pageWidth);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const setFontFamily = usePreferencesStore((s) => s.setFontFamily);
  const setFontSize = usePreferencesStore((s) => s.setFontSize);

  const { t, locale } = useTranslation();

  const {
    handleCreateHighlight,
    handleCreateComment,
    handleResolveComment,
    handleReplyToComment,
    handleEditComment,
    handleDeleteComment,
    handleEditHighlight,
    handleDeleteHighlight,
  } = useAnnotationHandlers();
  const { handleCreateBookmark, handleDeleteBookmark } = useBookmarkHandlers();
  const { handleExportNotes } = useExportNotes();

  const rootRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null!);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const renderHighlightsRef = useRef<((r: Rendition, ch: string | null) => void) | null>(null);
  const renderCommentMarkersRef = useRef<((r: Rendition, ch: string | null) => void) | null>(null);

  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const { renditionRef, currentChapterRef, toc, resolvedTheme } = useReaderEpub(
    epubUrl,
    viewerRef,
    rootRef,
    renderHighlightsRef,
    renderCommentMarkersRef,
  );

  useEffect(() => {
    if (!sessionToken || !bookId) return;
    const load = async () => {
      try {
        const [hl, cm] = await Promise.all([
          fetchHighlights(bookId, sessionToken),
          fetchComments(bookId, sessionToken),
        ]);
        setHighlights(hl);
        setComments(cm);
      } catch (err) {
        console.warn('Failed to fetch annotations', err);
      }
    };
    void load();
  }, [sessionToken, bookId, setHighlights, setComments]);

  useEffect(() => {
    const onMouseUp = () => {
      if (iframeRef.current && !isCommentMode) {
        const sel = extractSelectionData(iframeRef.current);
        setSelection(sel && sel.text.length >= 3 ? sel : null);
      }
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [isCommentMode, setSelection]);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setOffline(!navigator.onLine);
    const cleanup = setupOnlineListener();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanup();
    };
  }, [setOffline]);

  useEffect(() => {
    if (!bookId) return;
    return setupZombieDetection((id) => setRevokedBooks((prev) => new Set(prev).add(id)));
  }, [bookId, setRevokedBooks]);

  useEffect(() => {
    if (revokedBooks.has(bookId || '')) {
      setError(t('reader.accessRevoked'));
      setPermissionStatus('invalid');
    }
  }, [revokedBooks, bookId, setError, setPermissionStatus, t]);

  const handleNavigateToAnnotation = useCallback(
    async (chapterRef: string, cfiRange?: string) => {
      if (!renditionRef.current) return;
      await renditionRef.current.display(cfiRange ?? chapterRef);
    },
    [renditionRef],
  );

  const renderHighlights = useCallback(
    (rendition: Rendition, chapterHref: string | null) =>
      renderHighlightsOnRendition(rendition, chapterHref, highlights),
    [highlights],
  );
  renderHighlightsRef.current = renderHighlights;

  const renderCommentMarkers = useCallback(
    (rendition: Rendition, chapterHref: string | null) =>
      renderCommentMarkersOnRendition(rendition, chapterHref, comments, (ref, cfi) => {
        void handleNavigateToAnnotation(ref, cfi);
      }),
    [comments, handleNavigateToAnnotation],
  );
  renderCommentMarkersRef.current = renderCommentMarkers;

  const handlePrevPage = useCallback(() => void renditionRef.current?.prev(), [renditionRef]);
  const handleNextPage = useCallback(() => void renditionRef.current?.next(), [renditionRef]);
  const handleAddBookmark = useCallback(
    () => void handleCreateBookmark(currentChapterRef, toc),
    [handleCreateBookmark, currentChapterRef, toc],
  );
  const handleHighlight = useCallback(() => {
    if (selection) {
      void handleCreateHighlight('yellow', selection);
      setSelection(null);
    }
  }, [selection, handleCreateHighlight, setSelection]);
  const handleComment = useCallback(() => {
    if (selection) {
      setShowCommentInput(true);
      setIsCommentMode(true);
    }
  }, [selection, setShowCommentInput, setIsCommentMode]);
  const handleToggleToc = useCallback(() => { togglePanel('toc'); }, [togglePanel]);
  const handleToggleBookmarks = useCallback(() => { togglePanel('bookmarks'); }, [togglePanel]);
  const handleToggleComments = useCallback(() => { togglePanel('comments'); }, [togglePanel]);
  const handleToggleSettings = useCallback(() => { togglePanel('settings'); }, [togglePanel]);
  const handleShowHelp = useCallback(() => { setShowShortcutsHelp(true); }, []);

  useKeyboardShortcuts({
    rendition: renditionRef.current,
    onPrevPage: handlePrevPage,
    onNextPage: handleNextPage,
    onAddBookmark: handleAddBookmark,
    onHighlight: handleHighlight,
    onComment: handleComment,
    onToggleToc: handleToggleToc,
    onToggleBookmarks: handleToggleBookmarks,
    onToggleComments: handleToggleComments,
    onToggleSettings: handleToggleSettings,
    onShowHelp: handleShowHelp,
  });

  useEffect(() => {
    if (!sessionToken || !bookSlug) {
      void navigate('/login');
      return;
    }
    const controller = new AbortController();
    const fetch = async () => {
      try {
        const data = await apiRequest<{ url: string }>(`/api/books/${bookSlug}/file-url`, {
          method: 'POST',
          token: sessionToken,
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        setEpubUrl(data.url);
      } catch (err) {
        if (!controller.signal.aborted)
          setError((err as Error).message || t('reader.notAvailable'));
      } finally {
        setIsLoading(false);
      }
    };
    void fetch();
    return () => controller.abort();
  }, [sessionToken, bookSlug, navigate, setError, t]);

  useEffect(() => {
    const r = renditionRef.current;
    if (r && currentChapterRef.current) renderHighlights(r, currentChapterRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs have stable identity; .current captured at execution time
  }, [highlights, renderHighlights]);

  useEffect(() => {
    const r = renditionRef.current;
    if (r && currentChapterRef.current) renderCommentMarkers(r, currentChapterRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs have stable identity; .current captured at execution time
  }, [comments, renderCommentMarkers]);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/access/logout', { method: 'POST', token: sessionToken ?? undefined });
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      logout();
      void navigate('/login');
    }
  };

  const navigateToChapter = async (href: string) => {
    if (renditionRef.current) {
      await renditionRef.current.display(href);
      setActivePanel(null);
    }
  };

  const pageWidthClass =
    { narrow: 'max-w-xl', normal: 'max-w-3xl', wide: 'max-w-5xl', full: 'max-w-full' }[
      readerPageWidth
    ] ?? 'max-w-3xl';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tFn = t as (key: string) => any;

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-background text-foreground"
      data-theme={resolvedTheme}
    >
      <a
        href="#reader-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        {t('reader.skipToContent')}
      </a>
      <ReaderToolbar
        bookTitle={bookTitle}
        bookSlug={bookSlug ?? ''}
        comments={comments}
        bookmarks={bookmarks}
        capabilities={capabilities}
        activePanel={activePanel}
        onToggleToc={() => togglePanel('toc')}
        onToggleComments={() => togglePanel('comments')}
        onToggleBookmarks={() => togglePanel('bookmarks')}
        onToggleSettings={() => togglePanel('settings')}
        onExportNotes={() => handleExportNotes(bookTitle)}
        onLogout={() => void handleLogout()}
        t={tFn}
      />
      <AnimatePresence>
        {activePanel === 'settings' && (
          <ReaderSettingsPanel
            isOpen={activePanel === 'settings'}
            onClose={() => setActivePanel(null)}
            theme={readerTheme}
            fontSize={readerFontSize}
            fontFamily={readerFontFamily}
            onSetTheme={setTheme}
            onSetFontSize={setFontSize}
            onSetFontFamily={setFontFamily}
            t={tFn}
          />
        )}
      </AnimatePresence>
      <ReaderViewer
        isLoading={isLoading}
        epubUrl={epubUrl}
        error={error}
        pageWidthClass={pageWidthClass}
        viewerRef={viewerRef}
        notAvailableText={t('reader.notAvailable')}
        id="reader-main-content"
      />
      <TableOfContents
        isOpen={activePanel === 'toc'}
        toc={toc}
        onClose={() => setActivePanel(null)}
        onNavigate={(href) => void navigateToChapter(href)}
        t={tFn}
      />
      {selection && capabilities?.canHighlight && (
        <AnnotationToolbar
          selection={selection}
          onHighlight={(color) => {
            void handleCreateHighlight(color, selection);
            setSelection(null);
          }}
          onComment={() => {
            setShowCommentInput(true);
            setIsCommentMode(true);
          }}
          onClose={() => {
            setSelection(null);
            setShowCommentInput(false);
            setIsCommentMode(false);
          }}
          locale={locale}
          canHighlight={capabilities?.canHighlight ?? false}
          canComment={capabilities?.canComment ?? false}
        />
      )}
      <CommentInputModal
        isOpen={showCommentInput && !!selection}
        selection={selection}
        onSubmit={(text) => {
          void handleCreateComment(text, selection);
          setSelection(null);
          setShowCommentInput(false);
          setIsCommentMode(false);
        }}
        onCancel={() => {
          setShowCommentInput(false);
          setIsCommentMode(false);
          setSelection(null);
        }}
        placeholder={t('comment.placeholder')}
        submitLabel={t('annotation.comment')}
      />
      <BookmarksPanel
        isOpen={activePanel === 'bookmarks'}
        bookmarks={bookmarks}
        onClose={() => setActivePanel(null)}
        onAddBookmark={() => void handleCreateBookmark(currentChapterRef, toc)}
        onDeleteBookmark={(id) => handleDeleteBookmark(id)}
        onNavigate={(bookmark) => {
          if (bookmark.locator.cfi && renditionRef.current)
            void renditionRef.current.display(bookmark.locator.cfi);
        }}
      />
      <CommentsPanel
        isOpen={activePanel === 'comments'}
        onClose={() => setActivePanel(null)}
        comments={comments}
        highlights={highlights}
        currentChapter={currentChapter}
        locale={locale}
        onResolveComment={(id) => void handleResolveComment(id)}
        onReplyToComment={(id, text) => void handleReplyToComment(id, text)}
        onEditComment={(id, text) => void handleEditComment(id, text)}
        onDeleteComment={(id) => void handleDeleteComment(id)}
        onEditHighlight={(id, note) => void handleEditHighlight(id, note)}
        onDeleteHighlight={(id) => void handleDeleteHighlight(id)}
        onNavigateToAnnotation={(ref, cfi) => void handleNavigateToAnnotation(ref, cfi)}
      />
      <AnimatePresence>
        {showShortcutsHelp && (
          <KeyboardShortcutsModal
            isOpen={showShortcutsHelp}
            onClose={() => { setShowShortcutsHelp(false); }}
            t={tFn}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

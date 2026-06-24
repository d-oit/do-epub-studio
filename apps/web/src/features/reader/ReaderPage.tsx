import { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useParams, useNavigate } from 'react-router-dom';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api/index';
import { logClientEvent } from '../../lib/client-logger';
import { fetchHighlights, fetchComments, fetchProgress } from '../../lib/api/index';
import { useAuthStore, useReaderStore, usePreferencesStore } from '../../stores';
import type { Bookmark } from '../../stores';
import { setupOnlineListener, getSyncQueue, getProgress } from '../../lib/offline';
import { setupZombieDetection } from '../../lib/offline/permissions';
import { AnnotationToolbar, extractSelectionData, CommentsPanel } from './components/annotations';
import {
  useReaderUI,
  useReaderEpub,
  useAnnotationHandlers,
  useBookmarkHandlers,
  useExportNotes,
  useReadingTimer,
} from './hooks';
import { AnimatePresence } from 'framer-motion';
import {
  ReaderToolbar,
  ReaderSettingsPanel,
  SearchPanel,
  TableOfContents,
  BookmarksPanel,
  ReaderViewer,
  CommentInputModal,
  InfoPanel,
  FixedLayoutControls,
} from './components';

export function ReaderPage() {
  const { bookSlug } = useParams<{ bookSlug: string }>();
  const navigate = useNavigate();

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

  const setError = useReaderStore((s) => s.setError);
  const error = useReaderStore((s) => s.error);
  const setOffline = useReaderStore((s) => s.setOffline);
  const setPendingSyncCount = useReaderStore((s) => s.setPendingSyncCount);
  const setPermissionStatus = useReaderStore((s) => s.setPermissionStatus);
  const progress = useReaderStore((s) => s.progress);
  const setProgress = useReaderStore((s) => s.setProgress);
  const bookDirection = useReaderStore((s) => s.bookDirection);
  const highlights = useReaderStore(useShallow((s) => s.highlights));
  const setHighlights = useReaderStore((s) => s.setHighlights);
  const comments = useReaderStore(useShallow((s) => s.comments));
  const setComments = useReaderStore((s) => s.setComments);
  const bookmarks = useReaderStore(useShallow((s) => s.bookmarks));
  const setBookmarks = useReaderStore((s) => s.setBookmarks);
  const currentChapter = useReaderStore((s) => s.currentChapter);
  const isFixedLayout = useReaderStore((s) => s.isFixedLayout);
  const readerSpread = useReaderStore((s) => s.readerSpread);
  const readerZoom = useReaderStore((s) => s.readerZoom);
  const setReaderSpread = useReaderStore((s) => s.setReaderSpread);
  const setReaderZoom = useReaderStore((s) => s.setReaderZoom);

  const readerTheme = usePreferencesStore((s) => s.reader.theme);
  const readerFontSize = usePreferencesStore((s) => s.reader.fontSize);
  const readerFontFamily = usePreferencesStore((s) => s.reader.fontFamily);
  const readerPageWidth = usePreferencesStore((s) => s.reader.pageWidth);
  const readerDirection = usePreferencesStore((s) => s.reader.direction);
  const readerWritingMode = usePreferencesStore((s) => s.reader.writingMode);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const setFontFamily = usePreferencesStore((s) => s.setFontFamily);
  const setFontSize = usePreferencesStore((s) => s.setFontSize);
  const setDirection = usePreferencesStore((s) => s.setDirection);
  const setWritingMode = usePreferencesStore((s) => s.setWritingMode);

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
  const {
    markLoaded: markInsightsLoaded,
    markPageRead,
    flush: flushInsights,
    syncToServer: syncInsightsToServer,
  } = useReadingTimer(bookId);

  const rootRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null as unknown as HTMLDivElement);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ref to the navigation callback so it can be passed to useReaderEpub
  // (declared below) without a temporal-dead-zone error. The callback is
  // updated on every render to read the latest renditionRef.
  const handleNavigateToAnnotationRef = useRef<
    (chapterRef: string, cfiRange?: string) => Promise<void>
  >(async () => {});

  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  const commentsRef = useRef(comments);
  commentsRef.current = comments;
  const { bookRef, renditionRef, currentChapterRef, toc, metadata } = useReaderEpub(
    epubUrl,
    viewerRef,
    rootRef,
    highlightsRef,
    commentsRef,
    handleNavigateToAnnotationRef.current,
    progress.locator?.cfi,
    markPageRead,
  );

  // Navigate to an annotation by displaying the given chapter/CFI on the
  // rendition. renditionRef is a stable useRef object, so its identity
  // never changes and including it in the deps array is safe.
  const handleNavigateToAnnotation = useCallback(
    async (chapterRef: string, cfiRange?: string) => {
      if (!renditionRef.current) return;
      await renditionRef.current.display(cfiRange ?? chapterRef);
    },
    [renditionRef],
  );
  handleNavigateToAnnotationRef.current = handleNavigateToAnnotation;

  useEffect(() => {
    if (!sessionToken || !bookId) return;
    const load = async () => {
      let source: 'server' | 'offline' | 'default' = 'default';
      try {
        const [hl, cm, bm, pg] = await Promise.all([
          fetchHighlights(bookId, sessionToken),
          fetchComments(bookId, sessionToken),
          apiRequest<Bookmark[]>(`/api/books/${bookId}/bookmarks`, { token: sessionToken }),
          fetchProgress(bookId, sessionToken),
        ]);
        setHighlights(hl);
        setComments(cm);
        setBookmarks(bm);
        setProgress(pg);
        source = 'server';
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logClientEvent({
          level: 'warn',
          event: 'reader.load_failed',
          traceId: createTraceId(),
          spanId: createSpanId(),
          error: { name: error.name, message: error.message, stack: error.stack },
          metadata: { bookId },
        });

        // Fallback to offline progress if server fetch fails
        try {
          const cached = await getProgress(bookId);
          if (cached) {
            setProgress({
              locator: { cfi: cached.cfi },
              progressPercent: cached.percentage,
              updatedAt: new Date(cached.lastRead).toISOString(),
            });
            source = 'offline';
          }
        } catch {
          /* ignore cache errors */
        }
      } finally {
        logClientEvent({
          level: 'info',
          event: 'reader.progress_loaded',
          traceId: createTraceId(),
          spanId: createSpanId(),
          metadata: { bookId, source },
        });
      }
    };
    void load();
  }, [sessionToken, bookId, setHighlights, setComments, setBookmarks, setProgress]);

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
    let cancelled = false;
    // biome-ignore lint/correctness/useQwikValidLexicalScope: React project, not Qwik — false positive
    const updateCount = async () => {
      try {
        const queue = await getSyncQueue();
        if (!cancelled) setPendingSyncCount(queue.length);
      } catch { /* IndexedDB may be unavailable */ }
    };
    void updateCount();
    const interval = setInterval(() => void updateCount(), 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [setPendingSyncCount]);

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

  useEffect(() => {
    if (!sessionToken || !bookSlug) {
      void navigate('/login');
      return;
    }
    const controller = new AbortController();
    let aborted = false;
    setIsLoading(true);
    const fetch = async () => {
      try {
        const data = await apiRequest<{ url: string }>(`/api/books/${bookSlug}/file-url`, {
          method: 'POST',
          token: sessionToken,
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        setEpubUrl(data.url);
        markInsightsLoaded();
      } catch (err) {
        if (!controller.signal.aborted)
          setError((err as Error).message || t('reader.notAvailable'));
      } finally {
        if (!aborted) {
          setIsLoading(false);
        }
      }
    };
    void fetch();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [sessionToken, bookSlug, navigate, setError, t, markInsightsLoaded]);

  useEffect(() => {
    return () => {
      void flushInsights();
      void syncInsightsToServer();
    };
  }, [flushInsights, syncInsightsToServer]);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/access/logout', { method: 'POST', token: sessionToken ?? undefined });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logClientEvent({
        level: 'error',
        event: 'reader.logout_failed',
        traceId: createTraceId(),
        spanId: createSpanId(),
        error: { name: error.name, message: error.message, stack: error.stack },
      });
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
  const tFn = t as (key: string) => string;

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-background text-foreground"
    >
      <ReaderToolbar
        bookTitle={bookTitle}
        bookSlug={bookSlug ?? ''}
        comments={comments}
        bookmarks={bookmarks}
        capabilities={capabilities}
        activePanel={activePanel}
        onToggleToc={() => togglePanel('toc')}
        onToggleSearch={() => { togglePanel('search'); }}
        onToggleComments={() => togglePanel('comments')}
        onToggleBookmarks={() => togglePanel('bookmarks')}
        onToggleSettings={() => togglePanel('settings')}
        onToggleInfo={() => togglePanel('info')}
        onExportNotes={() => handleExportNotes(bookTitle)}
        onLogout={() => void handleLogout()}
        t={tFn}
        isFixedLayout={isFixedLayout}
        onToggleFixedLayoutControls={() => {
          togglePanel('fl-controls');
        }}
      />
      <AnimatePresence>
        {activePanel === 'settings' && (
          <ReaderSettingsPanel
            isOpen
            onClose={() => setActivePanel(null)}
            theme={readerTheme}
            fontSize={readerFontSize}
            fontFamily={readerFontFamily}
            direction={readerDirection}
            writingMode={readerWritingMode}
            onSetTheme={setTheme}
            onSetFontSize={setFontSize}
            onSetFontFamily={setFontFamily}
            onSetDirection={setDirection}
            onSetWritingMode={setWritingMode}
            isFixedLayout={isFixedLayout}
            t={tFn}
          />
        )}
        {activePanel === 'fl-controls' && isFixedLayout && (
          <FixedLayoutControls
            isOpen
            onClose={() => setActivePanel(null)}
            zoom={readerZoom}
            spread={readerSpread}
            onSetZoom={setReaderZoom}
            onSetSpread={setReaderSpread}
            t={tFn}
          />
        )}
        {activePanel === 'info' && (
          <InfoPanel
            isOpen
            onClose={() => setActivePanel(null)}
            metadata={metadata}
            bookId={bookId}
            progressPercent={progress.progressPercent}
            t={tFn}
          />
        )}
        {activePanel === 'search' && (
          <SearchPanel
            isOpen
            book={bookRef.current}
            onClose={() => { setActivePanel(null); }}
            onNavigate={(cfi) => {
              if (renditionRef.current) void renditionRef.current.display(cfi);
            }}
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
      />
      <AnimatePresence>
        {activePanel === 'toc' && (
          <TableOfContents
            isOpen
            toc={toc}
            currentChapter={currentChapter}
            onClose={() => setActivePanel(null)}
            onNavigate={(href) => void navigateToChapter(href)}
            t={tFn}
            direction={bookDirection === 'rtl' ? 'rtl' : undefined}
          />
        )}
      </AnimatePresence>
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
      <AnimatePresence>
        {activePanel === 'bookmarks' && (
          <BookmarksPanel
            isOpen
            bookmarks={bookmarks}
            onClose={() => setActivePanel(null)}
            onAddBookmark={() => void handleCreateBookmark(currentChapterRef, toc)}
            onDeleteBookmark={(id) => handleDeleteBookmark(id)}
            onNavigate={(bookmark) => {
              if (bookmark.locator.cfi && renditionRef.current)
                void renditionRef.current.display(bookmark.locator.cfi);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activePanel === 'comments' && (
          <CommentsPanel
            isOpen
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
        )}
      </AnimatePresence>
    </div>
  );
}

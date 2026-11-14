import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { setupZombieDetection } from '../../lib/offline/permissions';
import { CommentsPanel } from './components/annotations';
import { SelectionOverlays } from './components/annotations/SelectionOverlays';
import {
  useReaderUI,
  useReaderEpub,
  useAnnotationHandlers,
  useBookmarkHandlers,
  useExportNotes,
  useReadingTimer,
  useOptimisticAnnotationStore,
  useReaderDataLoader,
  useReaderLogout,
  useBookFileUrl,
  useMediaOverlay,
  useIframeSelectionObserver,
} from './hooks';
import { useFeedbackComposer } from './hooks/useFeedbackComposer';
import { useFlushInsightsOnExit, useOpenInfoPanel } from './hooks/useInsightFlushes';
import {
  ReaderToolbar,
  ReaderSettingsPanel,
  SearchPanel,
  TableOfContents,
  BookmarksPanel,
  ReaderViewer,
  InfoPanel,
  FixedLayoutControls,
  ScrollProgressBar,
} from './components';
const MediaOverlayBar = lazy(() =>
  import('./components/toolbar/MediaOverlayBar').then((m) => ({ default: m.MediaOverlayBar })),
);
import { AnnotationInterchangeBar } from './components/toolbar/AnnotationInterchangeBar';
import { ConflictResolutionPanel } from './components/conflicts/ConflictResolutionPanel';
import { NotificationPanel } from './components/notifications/NotificationPanel';
import { useAuthStore, useReaderStore, usePreferencesStore } from '../../stores';
import { initAiPlugins } from '../../lib/ai-plugins';

// Reader route owns AI features (GOAP-262, issue #318): registering here keeps the
// reader-core extension point out of the shared entry graph, honoring the
// ADR-107 route boundary rules (catalog/admin/auth must not import
// reader-core). Idempotent.
initAiPlugins();
const WIDTHS: Record<string, string> = {
  narrow: 'max-w-xl',
  normal: 'max-w-3xl',
  wide: 'max-w-5xl',
  full: 'max-w-full',
};

export function ReaderPage() {
  const { bookSlug } = useParams<{ bookSlug: string }>();

  const sessionToken = useAuthStore((s) => s.sessionToken);
  const bookId = useAuthStore((s) => s.bookId);
  const bookTitle = useAuthStore((s) => s.bookTitle);
  const capabilities = useAuthStore(useShallow((s) => s.capabilities));

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
  const setPermissionStatus = useReaderStore((s) => s.setPermissionStatus);
  const progress = useReaderStore((s) => s.progress);
  const setProgress = useReaderStore((s) => s.setProgress);
  const bookDirection = useReaderStore((s) => s.bookDirection);
  const highlights = useReaderStore(useShallow((s) => s.highlights));
  const setHighlights = useReaderStore((s) => s.setHighlights);
  const comments = useReaderStore(useShallow((s) => s.comments));
  const setComments = useReaderStore((s) => s.setComments);
  const setBookmarks = useReaderStore((s) => s.setBookmarks);
  const currentChapter = useReaderStore((s) => s.currentChapter);
  const isFixedLayout = useReaderStore((s) => s.isFixedLayout);
  const renditions = useReaderStore((s) => s.renditions);
  const activeRendition = useReaderStore((s) => s.activeRendition);
  const readerSpread = useReaderStore((s) => s.readerSpread);
  const readerZoom = useReaderStore((s) => s.readerZoom);
  const setReaderSpread = useReaderStore((s) => s.setReaderSpread);
  const setReaderZoom = useReaderStore((s) => s.setReaderZoom);

  const {
    theme: readerTheme,
    fontSize: readerFontSize,
    fontFamily: readerFontFamily,
    pageWidth: readerPageWidth,
    direction: readerDirection,
    writingMode: readerWritingMode,
    aiEnabled,
  } = usePreferencesStore(useShallow((s) => s.reader));
  const { setTheme, setFontFamily, setFontSize, setDirection, setWritingMode, setAiEnabled } =
    usePreferencesStore();

  const { t, locale } = useTranslation();

  const { state: optimisticState } = useOptimisticAnnotationStore();

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
  const feedback = useFeedbackComposer(bookId);
  const { handleExportNotes } = useExportNotes();
  const {
    markLoaded: markInsightsLoaded,
    markPageRead,
    setChapter,
    flush: flushInsights,
    syncToServer: syncInsightsToServer,
  } = useReadingTimer(bookId);

  const rootRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);

  const resetSelection = () => {
    setSelection(null);
    setShowCommentInput(false);
    setIsCommentMode(false);
  };
  /**
   * A5/GOAP-300: resolve the signed book-file URL, caching it encrypted at rest
   * so an offline reload can still open the book. A failed *online* request
   * (revoked or expired capability) must surface as an error rather than
   * silently reading the stale cached URL.
   */
  const { epubUrl, bookFileIdRef } = useBookFileUrl({
    sessionToken,
    bookSlug,
    bookId,
    unavailableMessage: t('reader.notAvailable'),
    onResolved: markInsightsLoaded,
    onLoadingChange: setIsLoading,
    onError: (message) => setError(message),
  });

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
  const { bookRef, renditionRef, currentChapterRef, toc, metadata, switchRendition } =
    useReaderEpub(
      epubUrl,
      viewerRef,
      rootRef,
      highlightsRef,
      commentsRef,
      handleNavigateToAnnotationRef.current,
      progress.locator?.cfi,
      markPageRead,
      setChapter,
    );
  const [isMediaOverlayOpen, setIsMediaOverlayOpen] = useState(false);
  const mediaOverlay = useMediaOverlay({
    book: bookRef.current,
    rendition: renditionRef.current,
    currentChapter,
    onError: setError,
  });

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

  useReaderDataLoader({
    sessionToken,
    bookId,
    setHighlights,
    setComments,
    setBookmarks,
    setProgress,
  });

  useIframeSelectionObserver({
    viewerRef,
    rootRef,
    renditionRef,
    currentChapterRef,
    bookFileIdRef,
    isCommentMode,
    setSelection,
  });

  useEffect(() => {
    if (!bookId || !sessionToken) return;
    return setupZombieDetection(sessionToken, (id) =>
      setRevokedBooks((prev) => new Set(prev).add(id)),
    );
  }, [bookId, sessionToken, setRevokedBooks]);

  useEffect(() => {
    if (revokedBooks.has(bookId || '')) {
      setError(t('reader.accessRevoked'));
      setPermissionStatus('invalid');
    }
  }, [revokedBooks, bookId, setError, setPermissionStatus, t]);

  useFlushInsightsOnExit(flushInsights, syncInsightsToServer);
  const openInfoPanel = useOpenInfoPanel(flushInsights, togglePanel);

  const handleLogout = useReaderLogout();

  const navigateToChapter = async (href: string) => {
    if (renditionRef.current) {
      await renditionRef.current.display(href);
      setActivePanel(null);
    }
  };
  const pageWidthClass = WIDTHS[readerPageWidth] ?? 'max-w-3xl';
  const tFn = t as (key: string) => string;

  return (
    <div ref={rootRef} className="min-h-dvh bg-background text-foreground">
      <ScrollProgressBar />
      <ReaderToolbar
        bookTitle={bookTitle}
        bookSlug={bookSlug ?? ''}
        comments={optimisticState.comments}
        bookmarks={optimisticState.bookmarks}
        capabilities={capabilities}
        activePanel={activePanel}
        toc={toc}
        currentChapter={currentChapter}
        onToggleToc={() => togglePanel('toc')}
        onToggleSearch={() => togglePanel('search')}
        onToggleComments={() => togglePanel('comments')}
        onToggleBookmarks={() => togglePanel('bookmarks')}
        onToggleSettings={() => togglePanel('settings')}
        onToggleInfo={openInfoPanel}
        onToggleNotifications={() => togglePanel('notifications')}
        onExportNotes={() => handleExportNotes(bookTitle)}
        onLogout={() => void handleLogout()}
        t={tFn}
        isFixedLayout={isFixedLayout}
        onToggleFixedLayoutControls={() => togglePanel('fl-controls')}
        hasMediaOverlays={mediaOverlay.hasMediaOverlays}
        isMediaOverlayActive={isMediaOverlayOpen || mediaOverlay.isPlaying}
        onToggleMediaOverlay={() => setIsMediaOverlayOpen((v) => !v)}
        renditions={renditions}
        activeRendition={activeRendition}
        onSelectRendition={(fullPath) => void switchRendition(fullPath)}
      />
      <AnnotationInterchangeBar bookId={bookId} bookTitle={bookTitle} onError={setError} />
      {mediaOverlay.hasMediaOverlays && (isMediaOverlayOpen || mediaOverlay.isPlaying) && (
        <Suspense fallback={null}>
          <MediaOverlayBar
            isPlaying={mediaOverlay.isPlaying}
            isPaused={mediaOverlay.isPaused}
            currentTime={mediaOverlay.currentTime}
            duration={mediaOverlay.duration}
            playbackRate={mediaOverlay.playbackRate}
            activeClip={mediaOverlay.activeClip}
            error={mediaOverlay.error}
            onTogglePlay={() => void mediaOverlay.togglePlay()}
            onSeek={mediaOverlay.seek}
            onNextPhrase={mediaOverlay.nextPhrase}
            onPreviousPhrase={mediaOverlay.previousPhrase}
            onSetPlaybackRate={mediaOverlay.setPlaybackRate}
            onClose={() => {
              mediaOverlay.pause();
              setIsMediaOverlayOpen(false);
            }}
            t={tFn}
          />
        </Suspense>
      )}
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
          aiEnabled={aiEnabled}
          onSetAiEnabled={setAiEnabled}
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
          onClose={() => setActivePanel(null)}
          onNavigate={(cfi) => {
            if (renditionRef.current) void renditionRef.current.display(cfi);
          }}
          t={tFn}
        />
      )}
      <ReaderViewer
        isLoading={isLoading}
        epubUrl={epubUrl}
        error={error}
        pageWidthClass={pageWidthClass}
        viewerRef={viewerRef}
        notAvailableText={t('reader.notAvailable')}
      />
      <ConflictResolutionPanel />
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
      <SelectionOverlays
        selection={selection}
        canHighlight={capabilities?.canHighlight ?? false}
        canComment={capabilities?.canComment ?? false}
        locale={locale}
        showCommentInput={showCommentInput}
        t={tFn}
        feedback={feedback}
        onHighlight={handleCreateHighlight}
        onCreateComment={async (text, sel) => {
          await handleCreateComment(text, sel);
          resetSelection();
        }}
        onStartComment={() => {
          setShowCommentInput(true);
          setIsCommentMode(true);
        }}
        onCancel={resetSelection}
        onFeedbackCleared={() => setSelection(null)}
      />
      {activePanel === 'bookmarks' && (
        <BookmarksPanel
          isOpen
          bookmarks={optimisticState.bookmarks}
          onClose={() => setActivePanel(null)}
          onAddBookmark={() => void handleCreateBookmark(currentChapterRef, toc)}
          onDeleteBookmark={(id) => handleDeleteBookmark(id)}
          onNavigate={(bookmark) => {
            if (bookmark.locator.cfi && renditionRef.current)
              void renditionRef.current.display(bookmark.locator.cfi);
          }}
        />
      )}
      {activePanel === 'comments' && (
        <CommentsPanel
          isOpen
          onClose={() => setActivePanel(null)}
          comments={optimisticState.comments}
          highlights={optimisticState.highlights}
          feedbackItems={feedback.items}
          canContribute={capabilities?.canComment ?? false}
          onWithdrawFeedback={(id) => void feedback.withdraw(id)}
          onRetryFeedback={(draftItemId) => void feedback.retryDraft(draftItemId)}
          onReplyFeedback={(id, text) => void feedback.reply(id, text)}
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
      {activePanel === 'notifications' && (
        <NotificationPanel
          onNavigateToComment={() => setActivePanel('comments')}
          t={tFn}
          onClose={() => setActivePanel(null)}
          token={sessionToken}
        />
      )}
    </div>
  );
}

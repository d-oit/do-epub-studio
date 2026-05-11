import { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useParams, useNavigate } from 'react-router-dom';
import ePub, { Book, Rendition } from 'epubjs';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import { fetchHighlights, fetchComments } from '../../lib/api/annotations';
import { useAuthStore, useReaderStore, usePreferencesStore, FONT_SIZES, LINE_HEIGHTS } from '../../stores';
import { saveProgress, queueSync, setupOnlineListener, generateMutationId } from '../../lib/offline';
import { setupZombieDetection } from '../../lib/offline/permissions';
import { AnnotationToolbar, extractSelectionData, CommentsPanel } from './components/annotations';
import { renderHighlightsOnRendition, renderCommentMarkersOnRendition } from './annotationRendering';
import { useReaderUI, useAnnotationHandlers, useBookmarkHandlers, useExportNotes } from './hooks';
import {
  ReaderToolbar, ReaderSettingsPanel, TableOfContents,
  BookmarksPanel, ReaderViewer, CommentInputModal,
} from './components';

interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

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
    showToc,
    setShowToc,
    showSettings,
    setShowSettings,
    showComments,
    setShowComments,
    showBookmarks,
    setShowBookmarks,
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
  const setProgress = useReaderStore((s) => s.setProgress);
  const setError = useReaderStore((s) => s.setError);
  const error = useReaderStore((s) => s.error);
  const setOffline = useReaderStore((s) => s.setOffline);
  const setPermissionStatus = useReaderStore((s) => s.setPermissionStatus);
  const highlights = useReaderStore(useShallow((s) => s.highlights));
  const setHighlights = useReaderStore((s) => s.setHighlights);
  const comments = useReaderStore(useShallow((s) => s.comments));
  const setComments = useReaderStore((s) => s.setComments);
  const bookmarks = useReaderStore(useShallow((s) => s.bookmarks));
  const setCurrentChapter = useReaderStore((s) => s.setCurrentChapter);
  const currentChapter = useReaderStore((s) => s.currentChapter);

  // usePreferencesStore atomic selectors
  const readerTheme = usePreferencesStore((s) => s.reader.theme);
  const readerFontSize = usePreferencesStore((s) => s.reader.fontSize);
  const readerFontFamily = usePreferencesStore((s) => s.reader.fontFamily);
  const readerLineHeight = usePreferencesStore((s) => s.reader.lineHeight);
  const readerPageWidth = usePreferencesStore((s) => s.reader.pageWidth);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const setFontFamily = usePreferencesStore((s) => s.setFontFamily);
  const setFontSize = usePreferencesStore((s) => s.setFontSize);

  const { t, locale } = useTranslation();

  const { handleCreateHighlight, handleCreateComment, handleResolveComment,
    handleReplyToComment, handleEditComment, handleDeleteComment,
    handleEditHighlight, handleDeleteHighlight } = useAnnotationHandlers();
  const { handleCreateBookmark, handleDeleteBookmark } = useBookmarkHandlers();
  const { handleExportNotes } = useExportNotes();

  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const currentChapterRef = useRef<string | null>(null);
  // Stable refs so the EPUB init effect calls the latest render fns without re-running on changes
  const renderHighlightsRef = useRef<((r: Rendition, ch: string | null) => void) | null>(null);
  const renderCommentMarkersRef = useRef<((r: Rendition, ch: string | null) => void) | null>(null);
  // Stable ref for toc so relocated handler always sees latest TOC without init effect depending on it
  const tocRef = useRef<TocItem[]>([]);

  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const applyTheme = useCallback(
    (rendition: Rendition) => {
      const themes = {
        light: { body: { background: '#ffffff', color: '#1a1a1a' }, img: { filter: 'none' } },
        dark: {
          body: { background: '#1a1a1a', color: '#e5e5e5' },
          img: { filter: 'invert(1) hue-rotate(180deg)' },
        },
        sepia: { body: { background: '#f4ecd8', color: '#5b4636' }, img: { filter: 'sepia(1)' } },
      } as const;
      const theme = themes[readerTheme === 'system' ? 'light' : readerTheme];
      if (theme) rendition.themes.default(theme.body);
    },
    [readerTheme],
  );

  const applyTypography = useCallback(
    (rendition: Rendition) => {
      rendition.themes.default({
        body: {
          'font-size': FONT_SIZES[readerFontSize],
          'line-height': LINE_HEIGHTS[readerLineHeight],
        },
      });
      if (readerFontFamily !== 'serif') {
        rendition.themes.default({
          body: {
            'font-family': readerFontFamily === 'sans-serif' ? 'sans-serif' : 'monospace',
          },
        });
      }
    },
    [readerFontSize, readerFontFamily, readerLineHeight],
  );

  const handleNavigateToAnnotation = useCallback(async (chapterRef: string, cfiRange?: string) => {
    if (!renditionRef.current) return;
    await renditionRef.current.display(cfiRange ?? chapterRef);
  }, []);

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

  useEffect(() => {
    if (!sessionToken || !bookSlug) {
      navigate('/login');
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
    if (!epubUrl || !viewerRef.current) return;
    const viewer = viewerRef.current;

    const initEpub = async () => {
      try {
        const book = ePub(epubUrl);
        bookRef.current = book;
        await book.ready;

        const navigation = await book.loaded.navigation;
        const tocItems: TocItem[] = navigation.toc
          ? navigation.toc.map((item) => ({ label: item.label, href: item.href }))
          : [];
        setToc(tocItems);
        tocRef.current = tocItems;

        const rendition = book.renderTo(viewer, { width: '100%', height: '100%', spread: 'auto' });
        renditionRef.current = rendition;
        applyTheme(rendition);
        applyTypography(rendition);
        await rendition.display();

        const initialLocation = rendition.location;
        if (initialLocation?.start) {
          const startHref = initialLocation.start.href ?? null;
          currentChapterRef.current = startHref;
          setCurrentChapter(startHref);
        }
        renderHighlightsRef.current?.(rendition, currentChapterRef.current);
        renderCommentMarkersRef.current?.(rendition, currentChapterRef.current);

        if (sessionToken && bookId) {
          try {
            const progressData = await apiRequest<{ locator: unknown; progressPercent: number }>(
              `/api/books/${bookId}/progress`,
              { method: 'GET', token: sessionToken },
            );
            const cfi = (progressData.locator as { cfi?: string } | null)?.cfi;
            if (cfi) await rendition.display(cfi);
          } catch (e) {
            console.warn('Failed to load progress', e);
          }
        }

        rendition.on(
          'relocated',
          async (location: { start: { cfi: string; progress: number; href: string } }) => {
            const { cfi, progress: progressPercent, href } = location.start;
            setProgress({ locator: { cfi }, progressPercent, updatedAt: new Date().toISOString() });

            const tocItem = tocRef.current.find((item) => item.href === href);
            if (tocItem) {
              currentChapterRef.current = tocItem.href;
              setCurrentChapter(tocItem.href);
            }

            renderHighlightsRef.current?.(rendition, currentChapterRef.current);
            renderCommentMarkersRef.current?.(rendition, currentChapterRef.current);

            if (sessionToken && bookId) {
              const mutationId = generateMutationId();
              const queueOffline = async () => {
                await saveProgress({
                  id: `${bookId}-progress`,
                  bookId,
                  cfi,
                  percentage: progressPercent,
                  lastRead: Date.now(),
                  synced: false,
                  mutationId,
                });
                await queueSync(
                  'progress',
                  { bookId, cfi, percentage: progressPercent, mutationId },
                  mutationId,
                );
              };
              if (navigator.onLine) {
                try {
                  await apiRequest(`/api/books/${bookId}/progress`, {
                    method: 'PUT',
                    token: sessionToken,
                    body: JSON.stringify({ locator: { cfi }, progressPercent, mutationId }),
                  });
                } catch (e) {
                  console.warn('Failed to save progress online, queuing offline', e);
                  await queueOffline();
                }
              } else {
                await queueOffline();
              }
            }
          },
        );
      } catch (err) {
        console.error('EPUB init error:', err);
        setError(t('reader.loadError'));
      }
    };

    void initEpub();

    return () => {
      const rendition = renditionRef.current;
      if (rendition) {
        for (const annotation of rendition.annotations.each()) {
          if ('cfiRange' in annotation) {
            rendition.annotations.remove(annotation.cfiRange as string, 'highlight');
            rendition.annotations.remove(annotation.cfiRange as string, 'underline');
          }
        }
      }
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
    };
  }, [
    epubUrl,
    sessionToken,
    bookId,
    applyTheme,
    applyTypography,
    setCurrentChapter,
    setError,
    setProgress,
    t,
  ]);

  useEffect(() => {
    if (renditionRef.current) applyTheme(renditionRef.current);
  }, [readerTheme, applyTheme]);

  useEffect(() => {
    if (renditionRef.current) applyTypography(renditionRef.current);
  }, [readerFontSize, readerFontFamily, readerLineHeight, applyTypography]);

  useEffect(() => {
    const r = renditionRef.current;
    if (r && currentChapterRef.current) renderHighlights(r, currentChapterRef.current);
  }, [highlights, renderHighlights]);

  useEffect(() => {
    const r = renditionRef.current;
    if (r && currentChapterRef.current) renderCommentMarkers(r, currentChapterRef.current);
  }, [comments, renderCommentMarkers]);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/access/logout', { method: 'POST', token: sessionToken ?? undefined });
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      logout();
      navigate('/login');
    }
  };

  const navigateToChapter = async (href: string) => {
    if (renditionRef.current) {
      await renditionRef.current.display(href);
      setShowToc(false);
    }
  };

  const themeClass = {
    light: 'bg-white text-gray-900',
    dark: 'bg-gray-900 text-gray-100',
    sepia: 'bg-amber-50 text-gray-800',
    system: 'bg-white text-gray-900',
  }[readerTheme];
  const pageWidthClass =
    { narrow: 'max-w-xl', normal: 'max-w-3xl', wide: 'max-w-5xl', full: 'max-w-full' }[
      readerPageWidth
    ] ?? 'max-w-3xl';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tFn = t as (key: string) => any;

  return (
    <div className={`min-h-screen ${themeClass}`}>
      <ReaderToolbar
        bookTitle={bookTitle}
        bookSlug={bookSlug ?? ''}
        comments={comments}
        bookmarks={bookmarks}
        capabilities={capabilities}
        onToggleToc={() => setShowToc(!showToc)}
        onToggleComments={() => setShowComments(!showComments)}
        onToggleBookmarks={() => setShowBookmarks(!showBookmarks)}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onExportNotes={() => handleExportNotes(bookTitle)}
        onLogout={() => void handleLogout()}
        t={tFn}
      />
      <ReaderSettingsPanel
        isOpen={showSettings}
        theme={readerTheme}
        fontSize={readerFontSize}
        fontFamily={readerFontFamily}
        onSetTheme={setTheme}
        onSetFontSize={setFontSize}
        onSetFontFamily={setFontFamily}
        t={tFn}
      />
      <ReaderViewer
        isLoading={isLoading}
        epubUrl={epubUrl}
        error={error}
        pageWidthClass={pageWidthClass}
        viewerRef={viewerRef}
        notAvailableText={t('reader.notAvailable')}
      />
      <TableOfContents
        isOpen={showToc}
        toc={toc}
        onClose={() => setShowToc(false)}
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
        isOpen={showBookmarks}
        bookmarks={bookmarks}
        onClose={() => setShowBookmarks(false)}
        onAddBookmark={() => void handleCreateBookmark(currentChapterRef, toc)}
        onDeleteBookmark={(id) => handleDeleteBookmark(id)}
        onNavigate={(bookmark) => {
          if (bookmark.locator.cfi && renditionRef.current)
            void renditionRef.current.display(bookmark.locator.cfi);
        }}
      />
      <CommentsPanel
        isOpen={showComments}
        onClose={() => setShowComments(false)}
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
    </div>
  );
}

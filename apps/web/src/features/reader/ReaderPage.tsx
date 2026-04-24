import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ePub, { Book, Rendition } from 'epubjs';

import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { useTranslation } from '../../hooks/useTranslation';
import { Header, IconButton, Button, Tooltip } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import {
  fetchHighlights,
  fetchComments,
  createHighlight,
  createComment,
  updateHighlight,
  deleteHighlight,
  updateComment,
} from '../../lib/api/annotations';
import {
  useAuthStore,
  useReaderStore,
  usePreferencesStore,
  FONT_SIZES,
  LINE_HEIGHTS,
} from '../../stores';
import {
  saveProgress,
  queueSync,
  setupOnlineListener,
  generateMutationId,
  saveAnnotation,
} from '../../lib/offline';
import { setupZombieDetection } from '../../lib/offline/permissions';
import {
  AnnotationToolbar,
  extractSelectionData,
  CommentsPanel,
  type SelectionData,
} from './components/annotations';
import { CommentInput } from './components/annotations/CommentInput';
import {
  renderHighlightsOnRendition,
  renderCommentMarkersOnRendition,
} from './annotationRendering';

interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

export function ReaderPage() {
  const { bookSlug } = useParams<{ bookSlug: string }>();
  const navigate = useNavigate();
  const { sessionToken, bookId, bookTitle, capabilities, logout } = useAuthStore();

  // Atomic selectors to avoid unnecessary re-renders (especially excluding 'progress')
  const setProgress = useReaderStore((state) => state.setProgress);
  const setError = useReaderStore((state) => state.setError);
  const error = useReaderStore((state) => state.error);
  const setOffline = useReaderStore((state) => state.setOffline);
  const setPermissionStatus = useReaderStore((state) => state.setPermissionStatus);
  const highlights = useReaderStore((state) => state.highlights);
  const setHighlights = useReaderStore((state) => state.setHighlights);
  const addHighlight = useReaderStore((state) => state.addHighlight);
  const updateHighlightInStore = useReaderStore((state) => state.updateHighlight);
  const removeHighlight = useReaderStore((state) => state.removeHighlight);
  const comments = useReaderStore((state) => state.comments);
  const setComments = useReaderStore((state) => state.setComments);
  const addComment = useReaderStore((state) => state.addComment);
  const updateCommentInStore = useReaderStore((state) => state.updateComment);
  const setCurrentChapter = useReaderStore((state) => state.setCurrentChapter);
  const currentChapter = useReaderStore((state) => state.currentChapter);
  const bookmarks = useReaderStore((state) => state.bookmarks);
  const addBookmark = useReaderStore((state) => state.addBookmark);
  const removeBookmark = useReaderStore((state) => state.removeBookmark);

  const {
    reader,
    setTheme,
    setFontFamily,
    setFontSize,
    setPageWidth: _setPageWidth,
  } = usePreferencesStore();
  const { t, locale } = useTranslation();

  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const currentChapterRef = useRef<string | null>(null);
  // Stable refs so the EPUB init effect can call the latest render functions
  // without listing them as deps (which would re-initialize the entire EPUB
  // on every annotation change).
  const renderHighlightsRef = useRef<((r: Rendition, ch: string | null) => void) | null>(null);
  const renderCommentMarkersRef = useRef<((r: Rendition, ch: string | null) => void) | null>(null);
  // Stable ref for toc so the relocated handler always sees the latest TOC
  // without the EPUB init effect depending on toc state.
  const tocRef = useRef<TocItem[]>([]);
  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [revokedBooks, setRevokedBooks] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<SelectionData | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [isCommentMode, setIsCommentMode] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);

  void _setPageWidth;

  useEffect(() => {
    if (!sessionToken || !bookId) return;

    const fetchAnnotations = async () => {
      try {
        const [fetchedHighlights, fetchedComments] = await Promise.all([
          fetchHighlights(bookId, sessionToken),
          fetchComments(bookId, sessionToken),
        ]);
        setHighlights(fetchedHighlights);
        setComments(fetchedComments);
      } catch (err) {
        console.warn('Failed to fetch annotations', err);
      }
    };

    void fetchAnnotations();
  }, [sessionToken, bookId, setHighlights, setComments]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (iframeRef.current && !isCommentMode) {
        const sel = extractSelectionData(iframeRef.current);
        if (sel && sel.text.length >= 3) {
          setSelection(sel);
        } else {
          setSelection(null);
        }
      }
    };

    document.addEventListener('mouseup', handleSelectionChange);
    return () => {
      document.removeEventListener('mouseup', handleSelectionChange);
    };
  }, [isCommentMode]);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setOffline(!navigator.onLine);

    const cleanupOnline = setupOnlineListener();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanupOnline();
    };
  }, [setOffline]);

  useEffect(() => {
    if (!bookId) return;

    const cleanup = setupZombieDetection((revokedBookId) => {
      setRevokedBooks((prev) => new Set(prev).add(revokedBookId));
    });
    return cleanup;
  }, [bookId]);

  useEffect(() => {
    if (revokedBooks.has(bookId || '')) {
      setError(t('reader.accessRevoked'));
      setPermissionStatus('invalid');
    }
  }, [revokedBooks, bookId, setError, setPermissionStatus, t]);

  const handleCreateHighlight = useCallback(
    async (color: string) => {
      if (!selection || !sessionToken || !bookId) return;

      try {
        const mutationId = generateMutationId();
        const highlight = await createHighlight(
          bookId,
          {
            chapterRef: selection.chapterRef,
            cfiRange: selection.cfiRange,
            selectedText: selection.text,
            color,
          },
          sessionToken,
        );
        addHighlight(highlight);
        setSelection(null);

        if (!navigator.onLine) {
          await saveAnnotation({
            id: highlight.id,
            bookId,
            type: 'highlight',
            cfi: selection.cfiRange,
            text: selection.text,
            color,
            createdAt: Date.now(),
            synced: false,
            mutationId,
          });
          await queueSync('annotation', { bookId, annotation: highlight }, mutationId);
        }
      } catch (err) {
        console.error('Failed to create highlight', err);
      }
    },
    [selection, sessionToken, bookId, addHighlight],
  );

  const handleCreateComment = useCallback(
    async (text: string) => {
      if (!selection || !sessionToken || !bookId) return;

      try {
        const comment = await createComment(
          bookId,
          {
            chapterRef: selection.chapterRef,
            cfiRange: selection.cfiRange,
            selectedText: selection.text,
            body: text,
          },
          sessionToken,
        );
        addComment(comment);
        setSelection(null);
        setShowCommentInput(false);
        setIsCommentMode(false);

        if (!navigator.onLine) {
          const mutationId = generateMutationId();
          await saveAnnotation({
            id: comment.id,
            bookId,
            type: 'comment',
            cfi: selection.cfiRange,
            text: selection.text,
            comment: text,
            chapter: selection.chapterRef,
            createdAt: Date.now(),
            synced: false,
            mutationId,
          });
          await queueSync('annotation', { bookId, annotation: comment }, mutationId);
        }
      } catch (err) {
        console.error('Failed to create comment', err);
      }
    },
    [selection, sessionToken, bookId, addComment],
  );

  const handleResolveComment = useCallback(
    async (commentId: string) => {
      if (!sessionToken || !bookId) return;

      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return;

      const newStatus = comment.status === 'resolved' ? 'open' : 'resolved';

      try {
        await updateComment(commentId, { status: newStatus }, sessionToken);
        updateCommentInStore(commentId, {
          status: newStatus,
          resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : null,
        });
      } catch (err) {
        console.error('Failed to update comment', err);
      }
    },
    [sessionToken, bookId, comments, updateCommentInStore],
  );

  const handleReplyToComment = useCallback(
    async (parentId: string, text: string) => {
      if (!sessionToken || !bookId) return;

      try {
        const comment = await createComment(
          bookId,
          { body: text, parentCommentId: parentId },
          sessionToken,
        );
        addComment(comment);
      } catch (err) {
        console.error('Failed to reply to comment', err);
      }
    },
    [sessionToken, bookId, addComment],
  );

  const handleEditComment = useCallback(
    async (commentId: string, text: string) => {
      if (!sessionToken) return;

      try {
        await updateComment(commentId, { body: text }, sessionToken);
        updateCommentInStore(commentId, { body: text, updatedAt: new Date().toISOString() });
      } catch (err) {
        console.error('Failed to edit comment', err);
      }
    },
    [sessionToken, updateCommentInStore],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!sessionToken) return;

      try {
        await updateComment(commentId, { status: 'deleted' }, sessionToken);
        updateCommentInStore(commentId, { status: 'deleted' });
      } catch (err) {
        console.error('Failed to delete comment', err);
      }
    },
    [sessionToken, updateCommentInStore],
  );

  const handleEditHighlight = useCallback(
    async (highlightId: string, note: string) => {
      if (!sessionToken || !bookId) return;

      try {
        await updateHighlight(bookId, highlightId, { note }, sessionToken);
        updateHighlightInStore(highlightId, { note, updatedAt: new Date().toISOString() });
      } catch (err) {
        console.error('Failed to update highlight', err);
      }
    },
    [sessionToken, bookId, updateHighlightInStore],
  );

  const handleDeleteHighlight = useCallback(
    async (highlightId: string) => {
      if (!sessionToken || !bookId) return;

      try {
        await deleteHighlight(bookId, highlightId, sessionToken);
        removeHighlight(highlightId);
      } catch (err) {
        console.error('Failed to delete highlight', err);
      }
    },
    [sessionToken, bookId, removeHighlight],
  );

  const handleNavigateToAnnotation = useCallback(async (chapterRef: string, cfiRange?: string) => {
    if (renditionRef.current) {
      if (cfiRange) {
        await renditionRef.current.display(cfiRange);
      } else if (chapterRef) {
        await renditionRef.current.display(chapterRef);
      }
    }
  }, []);

  const applyTheme = useCallback(
    (rendition: Rendition) => {
      const themes: Record<string, { body: Record<string, string>; img: Record<string, string> }> =
        {
          light: { body: { background: '#ffffff', color: '#1a1a1a' }, img: { filter: 'none' } },
          dark: {
            body: { background: '#1a1a1a', color: '#e5e5e5' },
            img: { filter: 'invert(1) hue-rotate(180deg)' },
          },
          sepia: { body: { background: '#f4ecd8', color: '#5b4636' }, img: { filter: 'sepia(1)' } },
        };
      const theme = themes[reader.theme === 'system' ? 'light' : reader.theme];
      if (theme) {
        rendition.themes.default(theme.body);
      }
    },
    [reader.theme],
  );

  const applyTypography = useCallback(
    (rendition: Rendition) => {
      const fontSize = FONT_SIZES[reader.fontSize];
      const lineHeight = LINE_HEIGHTS[reader.lineHeight];
      rendition.themes.default({
        body: { 'font-size': fontSize, 'line-height': lineHeight },
      });
      if (reader.fontFamily !== 'serif') {
        const fontFamily = reader.fontFamily === 'sans-serif' ? 'sans-serif' : 'monospace';
        rendition.themes.default({ body: { 'font-family': fontFamily } });
      }
    },
    [reader.fontSize, reader.fontFamily, reader.lineHeight],
  );

  const renderHighlights = useCallback(
    (rendition: Rendition, chapterHref: string | null) => {
      renderHighlightsOnRendition(rendition, chapterHref, highlights);
    },
    [highlights],
  );
  // Keep the ref current so the EPUB init effect always calls the latest version
  renderHighlightsRef.current = renderHighlights;

  const renderCommentMarkers = useCallback(
    (rendition: Rendition, chapterHref: string | null) => {
      renderCommentMarkersOnRendition(rendition, chapterHref, comments, (chapterRef, cfiRange) => {
        void handleNavigateToAnnotation(chapterRef, cfiRange);
      });
    },
    [comments, handleNavigateToAnnotation],
  );
  // Keep the ref current so the EPUB init effect always calls the latest version
  renderCommentMarkersRef.current = renderCommentMarkers;

  const handleCreateBookmark = useCallback(async () => {
    if (!sessionToken || !bookId) return;

    const currentProgress = useReaderStore.getState().progress;
    if (!currentProgress?.locator?.cfi) return;

    const chapterName = currentChapterRef.current
      ? toc.find((item) => item.href === currentChapterRef.current)?.label || 'Unknown Chapter'
      : 'Unknown Chapter';

    const bookmark = {
      id: `bookmark-${Date.now()}`,
      locator: currentProgress.locator,
      label: chapterName,
      createdAt: new Date().toISOString(),
    };

    addBookmark(bookmark);

    if (!navigator.onLine) {
      const mutationId = generateMutationId();
      await saveAnnotation({
        id: bookmark.id,
        bookId,
        type: 'bookmark',
        cfi: currentProgress.locator.cfi,
        text: chapterName,
        chapter: currentChapterRef.current ?? undefined,
        createdAt: Date.now(),
        synced: false,
        mutationId,
      });
      await queueSync('annotation', { bookId, annotation: bookmark }, mutationId);
    }
  }, [sessionToken, bookId, addBookmark, toc]);

  const handleDeleteBookmark = useCallback(
    async (bookmarkId: string) => {
      removeBookmark(bookmarkId);
    },
    [removeBookmark],
  );

  const handleExportNotes = useCallback(() => {
    const notesContent = [
      `# ${bookTitle || 'Book'} - Exported Notes`,
      ``,
      `## Highlights`,
      ``,
      ...highlights.map((h) => `- ${h.selectedText} (${h.color})${h.note ? ` — ${h.note}` : ''}`),
      ``,
      `## Comments`,
      ``,
      ...comments
        .filter((c) => c.status !== 'deleted')
        .map((c) => `- ${c.body}${c.selectedText ? ` — "${c.selectedText.slice(0, 80)}..."` : ''}`),
      ``,
    ].join('\n');

    const blob = new Blob([notesContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bookTitle || 'notes'}-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [bookTitle, highlights, comments]);

  useEffect(() => {
    if (!sessionToken || !bookSlug) {
      navigate('/login');
      return;
    }

    const controller = new AbortController();

    const fetchBookUrl = async () => {
      try {
        const data = await apiRequest<{ url: string }>(`/api/books/${bookSlug}/file-url`, {
          method: 'POST',
          token: sessionToken,
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        setEpubUrl(data.url);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError((err as Error).message || t('reader.notAvailable'));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchBookUrl();
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
        const tocItems: TocItem[] = [];
        if (navigation.toc) {
          for (const item of navigation.toc) {
            tocItems.push({ label: item.label, href: item.href });
          }
        }
        setToc(tocItems);
        tocRef.current = tocItems;

        const rendition = book.renderTo(viewer, {
          width: '100%',
          height: '100%',
          spread: 'auto',
        });
        renditionRef.current = rendition;

        applyTheme(rendition);
        applyTypography(rendition);

        await rendition.display();

        // Capture initial chapter and render highlights + comment markers
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
            if (progressData.locator) {
              const cfi = (progressData.locator as { cfi?: string }).cfi;
              if (cfi) {
                await rendition.display(cfi);
              }
            }
          } catch (e) {
            console.warn('Failed to load progress', e);
          }
        }

        rendition.on(
          'relocated',
          async (location: { start: { cfi: string; progress: number; href: string } }) => {
            const cfi = location.start.cfi;
            const progressPercent = location.start.progress;
            const href = location.start.href;
            setProgress({
              locator: { cfi },
              progressPercent,
              updatedAt: new Date().toISOString(),
            });

            const currentTocItem = tocRef.current.find((item) => item.href === href);
            if (currentTocItem) {
              currentChapterRef.current = currentTocItem.href;
              setCurrentChapter(currentTocItem.href);
            }

            renderHighlightsRef.current?.(rendition, currentChapterRef.current);
            renderCommentMarkersRef.current?.(rendition, currentChapterRef.current);

            if (sessionToken && bookId) {
              const mutationId = generateMutationId();
              if (navigator.onLine) {
                try {
                  await apiRequest(`/api/books/${bookId}/progress`, {
                    method: 'PUT',
                    token: sessionToken,
                    body: JSON.stringify({ locator: { cfi }, progressPercent, mutationId }),
                  });
                } catch (e) {
                  console.warn('Failed to save progress online, queuing offline', e);
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
                }
              } else {
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
        // Remove all highlight and comment annotations before destroying
        const existing = rendition.annotations.each();
        for (const annotation of existing) {
          if ('cfiRange' in annotation) {
            rendition.annotations.remove(annotation.cfiRange as string, 'highlight');
            rendition.annotations.remove(annotation.cfiRange as string, 'underline');
          }
        }
      }
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
    };
  }, [epubUrl, sessionToken, bookId, applyTheme, applyTypography, setCurrentChapter, setError, setProgress, t]);

  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current);
    }
  }, [reader.theme, applyTheme]);

  useEffect(() => {
    if (renditionRef.current) {
      applyTypography(renditionRef.current);
    }
  }, [reader.fontSize, reader.fontFamily, reader.lineHeight, applyTypography]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !currentChapterRef.current) return;
    renderHighlights(rendition, currentChapterRef.current);
  }, [highlights, renderHighlights]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !currentChapterRef.current) return;
    renderCommentMarkers(rendition, currentChapterRef.current);
  }, [comments, renderCommentMarkers]);

  const handleLogout = async () => {
    try {
      await apiRequest('/api/access/logout', {
        method: 'POST',
        token: sessionToken ?? undefined,
      });
    } catch (error) {
      console.error('Logout failed', error);
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
  }[reader.theme];

  const pageWidthClass = {
    narrow: 'max-w-xl',
    normal: 'max-w-3xl',
    wide: 'max-w-5xl',
    full: 'max-w-full',
  }[reader.pageWidth];

  return (
    <div className={`min-h-screen ${themeClass}`}>
      <Header sticky glass className="border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Tooltip content={t('reader.tableOfContents')}>
              <IconButton
                onClick={() => setShowToc(!showToc)}
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
            <h1 className="font-medium truncate max-w-[200px] md:max-w-xs text-foreground">
              {bookTitle || bookSlug}
            </h1>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {capabilities?.canComment && (
              <Tooltip content={t('annotation.comment')}>
                <IconButton
                  onClick={() => setShowComments(!showComments)}
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
                  {comments.filter((c) => c.status === 'open').length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                      {comments.filter((c) => c.status === 'open').length}
                    </span>
                  )}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip content="View bookmarks">
              <IconButton
                onClick={() => setShowBookmarks(!showBookmarks)}
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
              <IconButton
                onClick={() => void handleExportNotes()}
                variant="ghost"
                aria-label="Export notes"
              >
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
                onClick={() => setShowSettings(!showSettings)}
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
            <Button
              onClick={() => void handleLogout()}
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
            >
              {t('reader.signOut')}
            </Button>
          </div>
        </div>
      </Header>

      {showSettings && (
        <div className="fixed top-14 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50 w-64">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('reader.theme')}</label>
              <div className="flex gap-2">
                {(['light', 'dark', 'sepia'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setTheme(theme)}
                    className={`px-3 py-1 text-sm rounded ${reader.theme === theme ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('reader.fontSize')}</label>
              <div className="flex gap-2">
                {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`px-2 py-1 text-xs rounded ${reader.fontSize === size ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                  >
                    {size[0].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('reader.fontFamily')}</label>
              <div className="flex gap-2">
                {(['serif', 'sans-serif', 'monospace'] as const).map((family) => (
                  <button
                    key={family}
                    onClick={() => setFontFamily(family)}
                    className={`px-2 py-1 text-xs rounded ${reader.fontFamily === family ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                  >
                    {family === 'serif' ? 'Serif' : family === 'sans-serif' ? 'Sans' : 'Mono'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="pt-14 pb-20">
        {error && (
          <div className="max-w-3xl mx-auto px-4 mt-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : epubUrl ? (
          <div className={`mx-auto px-4 py-8 ${pageWidthClass}`}>
            <div
              ref={viewerRef}
              className="h-[calc(100vh-8rem)] bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <p className="text-gray-500 dark:text-gray-400">{t('reader.notAvailable')}</p>
          </div>
        )}
      </main>

      {showToc && (
        <aside className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="font-semibold">{t('reader.tableOfContents')}</h2>
            <button
              onClick={() => setShowToc(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <nav className="p-2">
            {toc.length > 0 ? (
              toc.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    void navigateToChapter(item.href);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {item.label}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-gray-500">{t('reader.noChapters')}</p>
            )}
          </nav>
        </aside>
      )}

      {selection && capabilities?.canHighlight && (
        <AnnotationToolbar
          selection={selection}
          onHighlight={(color) => void handleCreateHighlight(color)}
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

      {showCommentInput && selection && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 max-w-md mx-auto"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <h3 className="text-sm font-medium mb-3">{t('annotation.comment')}</h3>
          <CommentInput
            onSubmit={(text) => void handleCreateComment(text)}
            onCancel={() => {
              setShowCommentInput(false);
              setIsCommentMode(false);
              setSelection(null);
            }}
            placeholder={t('comment.placeholder')}
            submitLabel={t('annotation.comment')}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional: comment input should auto-focus for UX
            autoFocus
          />
        </div>
      )}

      {showBookmarks && (
        <aside className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 z-40 flex flex-col shadow-xl">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="font-semibold">Bookmarks</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleCreateBookmark()}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Add bookmark at current position"
                aria-label="Add bookmark"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
              <button
                onClick={() => setShowBookmarks(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {bookmarks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                No bookmarks yet. Click the bookmark icon to save your place.
              </p>
            ) : (
              <div className="space-y-3">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <button
                        onClick={() => {
                          if (bookmark.locator.cfi && renditionRef.current) {
                            void renditionRef.current.display(bookmark.locator.cfi);
                          }
                        }}
                        className="flex-1 text-left"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {bookmark.label || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {new Date(bookmark.createdAt).toLocaleDateString()}
                        </p>
                      </button>
                      <button
                        onClick={() => void handleDeleteBookmark(bookmark.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        aria-label="Delete bookmark"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      <CommentsPanel
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        comments={comments}
        highlights={highlights}
        onResolveComment={(id) => void handleResolveComment(id)}
        onReplyToComment={(id, text) => void handleReplyToComment(id, text)}
        onEditComment={(id, text) => void handleEditComment(id, text)}
        onDeleteComment={(id) => void handleDeleteComment(id)}
        onEditHighlight={(id, note) => void handleEditHighlight(id, note)}
        onDeleteHighlight={(id) => void handleDeleteHighlight(id)}
        onNavigateToAnnotation={(chapterRef, cfiRange) =>
          void handleNavigateToAnnotation(chapterRef, cfiRange)
        }
        currentChapter={currentChapter}
        locale={locale}
      />
    </div>
  );
}

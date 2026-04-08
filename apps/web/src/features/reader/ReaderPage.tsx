import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ePub, { Book, Rendition } from 'epubjs';

import { LocaleSwitcher } from '../../components/LocaleSwitcher';
import { useTranslation } from '../../hooks/useTranslation';
import { apiRequest } from '../../lib/api';
import {
  useAuthStore,
  useReaderStore,
  usePreferencesStore,
  FONT_SIZES,
  LINE_HEIGHTS,
} from '../../stores';

interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

export function ReaderPage() {
  const { bookSlug } = useParams<{ bookSlug: string }>();
  const navigate = useNavigate();
  const { sessionToken, bookId, bookTitle, capabilities: _capabilities, logout } = useAuthStore();
  const { progress: _progress, setProgress, setError, error } = useReaderStore();
  const {
    reader,
    setTheme,
    setFontFamily,
    setFontSize,
    setPageWidth: _setPageWidth,
  } = usePreferencesStore();
  const { t } = useTranslation();

  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  void _progress;
  void _setPageWidth;

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

        const rendition = book.renderTo(viewer, {
          width: '100%',
          height: '100%',
          spread: 'auto',
        });
        renditionRef.current = rendition;

        applyTheme(rendition);
        applyTypography(rendition);

        await rendition.display();

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
          async (location: { start: { cfi: string; progress: number } }) => {
            const cfi = location.start.cfi;
            const progressPercent = location.start.progress;
            setProgress({
              locator: { cfi },
              progressPercent,
              updatedAt: new Date().toISOString(),
            });

            if (sessionToken && bookId) {
              try {
                await apiRequest(`/api/books/${bookId}/progress`, {
                  method: 'PUT',
                  token: sessionToken,
                  body: JSON.stringify({ locator: { cfi }, progressPercent }),
                });
              } catch (e) {
                console.warn('Failed to save progress', e);
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
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
    };
  }, [epubUrl, sessionToken, bookId, applyTheme, applyTypography, setError, setProgress, t]);

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
      <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowToc(!showToc)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
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
            </button>
            <h1 className="font-medium truncate max-w-xs">{bookTitle || bookSlug}</h1>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
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
            </button>
            <LocaleSwitcher />
            <button
              onClick={() => {
                void handleLogout();
              }}
              className="px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {t('reader.signOut')}
            </button>
          </div>
        </div>
      </header>

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
    </div>
  );
}

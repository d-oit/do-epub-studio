import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AuthorAssetMetadata, AuthorPublication } from '@do-epub-studio/shared';
import type { EpubLoader, EpubRenditionHandle } from '@do-epub-studio/reader-core';
import type { Rendition } from '@intity/epub-js';
import { createEpubLoader } from '@do-epub-studio/reader-core';
import {
  collectRequiredAuthorAssetIds,
  packageEpub3,
  type PackagedAsset,
} from '@do-epub-studio/reader-core/packager';
import { Button } from '../../../components/ui';
import { fetchAuthorAsset } from '../../../lib/api/author-assets';
import { READER_PAGE_WIDTH_CLASSES } from '../../../lib/reader-page-width';
import { usePreferencesStore } from '../../../stores';
import { useTranslation } from '../../../hooks/useTranslation';
import { applyDirectionToContents } from '../../reader/lib/epub-init';
import { createThemeApplier } from '../../reader/hooks/useReaderEpub.helpers';
import { resolvePreviewDirection } from '../author-preview';

interface AuthorEpubPreviewProps {
  bookId: string;
  publication: AuthorPublication;
  assets: AuthorAssetMetadata[];
  updatedAt: string;
  token?: string | null;
}

/** Latest direction per preview rendition; the content hook reads this. */
const directionSettings = new WeakMap<EpubRenditionHandle, { dir: string }>();

type PreviewStatus = 'loading' | 'ready' | 'error';

export function AuthorEpubPreview({
  bookId,
  publication,
  assets,
  updatedAt,
  token,
}: AuthorEpubPreviewProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<EpubRenditionHandle | null>(null);
  const [rendition, setRendition] = useState<EpubRenditionHandle | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const prefs = usePreferencesStore((state) => state.reader);
  const fixedLayoutRef = useRef(false);
  const applyThemeRef = useRef<(target: Pick<Rendition, 'themes'>) => void>(() => {});
  applyThemeRef.current = createThemeApplier({
    rootRef: containerRef,
    readerTheme: prefs.theme,
    fixedLayoutRef,
    readerFontSize: prefs.fontSize,
    readerLineHeight: prefs.lineHeight,
    readerFontFamily: prefs.fontFamily,
    readerWritingMode: prefs.writingMode,
  });
  const direction = resolvePreviewDirection(prefs.direction, publication.language);

  useLayoutEffect(() => {
    let cancelled = false;
    let loader: EpubLoader | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let displayedListener: (() => void) | null = null;
    renditionRef.current = null;
    setRendition(null);
    setStatus('loading');
    setError(null);

    const openPreview = async () => {
      try {
        const requiredAssetIds = collectRequiredAuthorAssetIds(publication);
        const packagedAssets: PackagedAsset[] = await Promise.all(
          assets
            .filter((asset) => requiredAssetIds.has(asset.id))
            .map(async (asset) => {
              const blob = await fetchAuthorAsset(bookId, asset, token);
              return {
                id: asset.id,
                data: new Uint8Array(await blob.arrayBuffer()),
                mediaType: asset.mediaType,
              };
            }),
        );
        const container = containerRef.current;
        if (cancelled || !container) return;
        const bytes = await packageEpub3(publication, packagedAssets, {
          identifier: publication.identifier?.trim() || `urn:uuid:${bookId}`,
          modifiedAt: updatedAt,
        });
        loader = createEpubLoader();
        await loader.load(bytes);
        if (cancelled || !containerRef.current) {
          loader.destroy();
          loader = null;
          return;
        }

        const initialWidth = container.clientWidth;
        const initialHeight = container.clientHeight;
        const renditionHandle = loader.createRendition(container);
        renditionRef.current = renditionHandle;
        setRendition(renditionHandle);
        displayedListener = () => {
          container.querySelector('iframe')?.setAttribute('title', t('author.preview.frameLabel'));
        };
        renditionHandle.on('displayed', displayedListener);
        await renditionHandle.display();
        if (cancelled) return;
        let previousWidth = initialWidth;
        let previousHeight = initialHeight;
        resizeObserver = new ResizeObserver(() => {
          if (cancelled || renditionRef.current !== renditionHandle) return;
          const width = container.clientWidth;
          const height = container.clientHeight;
          if (width <= 0 || height <= 0) {
            previousWidth = width;
            previousHeight = height;
            return;
          }
          if (width === previousWidth && height === previousHeight) return;
          previousWidth = width;
          previousHeight = height;
          renditionHandle.resize(width, height);
        });
        resizeObserver.observe(container);
        displayedListener?.();
        setStatus('ready');
      } catch (previewError) {
        if (!cancelled) {
          setError(
            previewError instanceof Error ? previewError.message : t('author.preview.error'),
          );
          setStatus('error');
        }
      }
    };

    void openPreview();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (displayedListener && renditionRef.current) {
        renditionRef.current.off('displayed', displayedListener);
      }
      renditionRef.current = null;
      loader?.destroy();
    };
  }, [assets, bookId, publication, retryKey, t, token, updatedAt]);

  // Theme: applied on first display and re-applied whenever reader typography or
  // theme preferences change — without reloading assets, repackaging, or
  // recreating the loader/rendition.
  useEffect(() => {
    const current = renditionRef.current;
    if (!current) return;
    applyThemeRef.current(current);
    if (current.getContents().length > 0) return;
    const applyOnFirstContent = () => {
      const active = renditionRef.current;
      if (!active) return;
      applyThemeRef.current(active);
      active.off('rendered', applyOnFirstContent);
    };
    current.on('rendered', applyOnFirstContent);
    return () => {
      current.off('rendered', applyOnFirstContent);
    };
  }, [
    rendition,
    prefs.theme,
    prefs.fontSize,
    prefs.fontFamily,
    prefs.lineHeight,
    prefs.writingMode,
  ]);

  // Direction: one content hook per rendition (covers chapters loaded later);
  // current contents update immediately so a preference change applies without
  // re-display.
  useEffect(() => {
    const current = renditionRef.current;
    if (!current) return;
    let settings = directionSettings.get(current);
    if (!settings) {
      const created = { dir: direction };
      directionSettings.set(current, created);
      current.registerContentHook((contents) => applyDirectionToContents(contents, created.dir));
      settings = created;
    }
    settings.dir = direction;
    for (const contents of current.getContents()) {
      applyDirectionToContents(contents, settings.dir);
    }
  }, [rendition, direction]);

  // In system theme mode, follow OS color-scheme changes like the reader does.
  useEffect(() => {
    if (prefs.theme !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const current = renditionRef.current;
      if (current) applyThemeRef.current(current);
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [prefs.theme, rendition]);

  const movePage = useCallback(
    async (direction: 'previous' | 'next') => {
      const renditionHandle = renditionRef.current;
      if (!renditionHandle) return;
      setIsNavigating(true);
      try {
        await (direction === 'previous' ? renditionHandle.prev() : renditionHandle.next());
      } catch (navigationError) {
        setError(
          navigationError instanceof Error ? navigationError.message : t('author.preview.error'),
        );
        setStatus('error');
      } finally {
        setIsNavigating(false);
      }
    },
    [t, setError, setIsNavigating, setStatus],
  );

  return (
    <section
      aria-label={t('author.tabs.preview')}
      className={`mx-auto w-full ${READER_PAGE_WIDTH_CLASSES[prefs.pageWidth]} space-y-4`}
    >
      <p className="text-sm text-foreground-muted">{t('author.preview.banner')}</p>
      <nav aria-label={t('author.preview.navigationLabel')} className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={status !== 'ready' || isNavigating}
          onClick={() => void movePage('previous')}
        >
          {t('author.preview.previous')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={status !== 'ready' || isNavigating}
          onClick={() => void movePage('next')}
        >
          {t('author.preview.next')}
        </Button>
      </nav>
      {status === 'loading' && (
        <p role="status" className="text-sm text-foreground-muted">
          {t('author.preview.loading')}
        </p>
      )}
      {status === 'error' && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-semantic-error">
          <p>{error ?? t('author.preview.error')}</p>
          <Button type="button" variant="secondary" onClick={() => setRetryKey((key) => key + 1)}>
            {t('author.preview.retry')}
          </Button>
        </div>
      )}
      <div
        data-testid="author-epub-preview"
        className="h-[68dvh] min-h-80 w-full overflow-hidden rounded-sm border border-border bg-surface"
        aria-busy={status === 'loading'}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </section>
  );
}

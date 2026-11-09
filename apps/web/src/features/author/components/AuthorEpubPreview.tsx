import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { AuthorAssetMetadata, AuthorPublication } from '@do-epub-studio/shared';
import { createEpubLoader } from '@do-epub-studio/reader-core';
import { packageEpub3, type PackagedAsset } from '@do-epub-studio/reader-core/packager';
import { Button } from '../../../components/ui';
import { fetchAuthorAsset } from '../../../lib/api/author-assets';
import { useTranslation } from '../../../hooks/useTranslation';

interface AuthorEpubPreviewProps {
  bookId: string;
  publication: AuthorPublication;
  assets: AuthorAssetMetadata[];
  updatedAt: string;
  token?: string | null;
}

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
  const renditionRef = useRef<ReturnType<
    ReturnType<typeof createEpubLoader>['createRendition']
  > | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useLayoutEffect(() => {
    let cancelled = false;
    let loader: ReturnType<typeof createEpubLoader> | null = null;
    renditionRef.current = null;
    setStatus('loading');
    setError(null);

    const openPreview = async () => {
      try {
        const packagedAssets: PackagedAsset[] = await Promise.all(
          assets.map(async (asset) => {
            const blob = await fetchAuthorAsset(bookId, asset, token);
            return {
              id: asset.id,
              data: new Uint8Array(await blob.arrayBuffer()),
              mediaType: asset.mediaType,
            };
          }),
        );
        if (cancelled || !containerRef.current) return;

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

        const rendition = loader.createRendition(containerRef.current);
        renditionRef.current = rendition;
        await rendition.display();
        if (cancelled) return;
        const iframe = containerRef.current.querySelector('iframe');
        iframe?.setAttribute('title', t('author.preview.frameLabel'));
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
      renditionRef.current = null;
      loader?.destroy();
    };
  }, [assets, bookId, publication, retryKey, t, token, updatedAt]);

  const movePage = useCallback(
    async (direction: 'previous' | 'next') => {
      const rendition = renditionRef.current;
      if (!rendition) return;
      setIsNavigating(true);
      try {
        await (direction === 'previous' ? rendition.prev() : rendition.next());
      } catch (navigationError) {
        setError(
          navigationError instanceof Error ? navigationError.message : t('author.preview.error'),
        );
        setStatus('error');
      } finally {
        setIsNavigating(false);
      }
    },
    [t],
  );

  return (
    <section aria-label={t('author.tabs.preview')} className="mx-auto w-full max-w-5xl space-y-4">
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

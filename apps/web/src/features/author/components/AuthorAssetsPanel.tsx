import { useRef, useState } from 'react';
import type { AuthorAssetMetadata } from '@do-epub-studio/shared';
import { MAX_AUTHOR_IMAGE_BYTES, MAX_AUTHOR_STYLESHEET_BYTES } from '@do-epub-studio/shared';
import { Button } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';

interface AuthorAssetsPanelProps {
  assets: AuthorAssetMetadata[];
  usedAssetIds: ReadonlySet<string>;
  stylesheetAssetIds: string[];
  isLoading: boolean;
  loadError: boolean;
  onRetry: () => void;
  onUpload: (file: File) => Promise<void>;
  onDelete: (assetId: string) => Promise<void>;
  onToggleStylesheet: (assetId: string, included: boolean) => void;
  onInsertImage: (asset: AuthorAssetMetadata) => void;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif']);

export function AuthorAssetsPanel({
  assets,
  usedAssetIds,
  stylesheetAssetIds,
  isLoading,
  loadError,
  onRetry,
  onUpload,
  onDelete,
  onToggleStylesheet,
  onInsertImage,
}: AuthorAssetsPanelProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    const limit = file.type === 'text/css' ? MAX_AUTHOR_STYLESHEET_BYTES : MAX_AUTHOR_IMAGE_BYTES;
    if (
      (!IMAGE_TYPES.has(file.type) && file.type !== 'text/css') ||
      file.size === 0 ||
      file.size > limit
    ) {
      setActionError(t('author.assets.tooLarge'));
      return;
    }
    setIsUploading(true);
    setActionError(null);
    try {
      await onUpload(file);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch {
      setActionError(t('author.assets.uploadError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    setBusyAssetId(assetId);
    setActionError(null);
    try {
      await onDelete(assetId);
    } catch {
      setActionError(t('author.assets.deleteError'));
    } finally {
      setBusyAssetId(null);
    }
  };

  return (
    <section aria-labelledby="author-assets-title" className="border-t border-border pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="author-assets-title" className="font-display text-lg font-semibold">
            {t('author.assets.title')}
          </h2>
          <p className="text-sm text-foreground-muted">{t('author.assets.summary')}</p>
        </div>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-foreground-muted">{t('author.assets.help')}</p>

      <form
        onSubmit={(event) => void handleUpload(event)}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <label className="min-w-0 flex-1 text-sm font-medium" htmlFor="author-asset-file">
          <span className="mb-1 block">{t('author.assets.chooseFile')}</span>
          <input
            ref={inputRef}
            id="author-asset-file"
            type="file"
            accept="image/jpeg,image/png,image/gif,text/css,.css"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setActionError(null);
            }}
            className="min-h-11 w-full rounded-sm border border-border bg-background px-2 py-2 text-base text-foreground file:me-3 file:min-h-9 file:rounded-sm file:border-0 file:bg-background-secondary file:px-3 file:text-sm file:font-medium file:text-foreground"
          />
        </label>
        <Button type="submit" disabled={!file || isUploading} isLoading={isUploading}>
          {isUploading ? t('author.assets.uploading') : t('author.assets.upload')}
        </Button>
      </form>

      {(actionError || loadError) && (
        <div className="mt-3 flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-semantic-error">
            {actionError ?? t('author.assets.loadError')}
          </p>
          {loadError && (
            <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
              {t('author.assets.retry')}
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="mt-4 text-sm text-foreground-muted" role="status">
          {t('author.assets.loading')}
        </p>
      ) : assets.length === 0 ? (
        <p className="mt-4 text-sm text-foreground-muted">{t('author.assets.empty')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {assets.map((asset) => {
            const used = usedAssetIds.has(asset.id);
            const isStylesheet = asset.mediaType === 'text/css';
            const stylesheetIncluded = stylesheetAssetIds.includes(asset.id);
            return (
              <li key={asset.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-medium text-foreground">{asset.name}</p>
                  <p className="text-xs text-foreground-muted">
                    {t('author.assets.details', {
                      mediaType: asset.mediaType,
                      size: asset.sizeBytes.toLocaleString(),
                      count: asset.sizeBytes,
                    })}
                  </p>
                  {used && (
                    <p className="mt-1 text-xs text-foreground-muted">{t('author.assets.used')}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isStylesheet ? (
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={stylesheetIncluded}
                        onChange={(event) => onToggleStylesheet(asset.id, event.target.checked)}
                        className="h-5 w-5 accent-accent"
                      />
                      <span>{t('author.assets.stylesheet', { name: asset.name })}</span>
                    </label>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onInsertImage(asset)}
                    >
                      {t('author.assets.insertImage', { name: asset.name })}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t('author.assets.remove', { name: asset.name })}
                    disabled={used || busyAssetId === asset.id}
                    isLoading={busyAssetId === asset.id}
                    onClick={() => void handleDelete(asset.id)}
                  >
                    {t('author.assets.remove', { name: asset.name })}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

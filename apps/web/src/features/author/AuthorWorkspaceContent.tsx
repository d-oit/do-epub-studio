import { lazy, Suspense, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { AuthorAssetMetadata, AuthorPublication, ChapterDraft } from '@do-epub-studio/shared';
import { parseAuthorContent } from '@do-epub-studio/reader-core/author-content';
import { deleteAuthorAsset, uploadAuthorAsset } from '../../lib/api/author-assets';
import { useTranslation } from '../../hooks/useTranslation';
import { AuthorAssetsPanel, ChapterEditor, ChapterSidebar } from './components';
import { escapeHtml } from './author-html';

interface AuthorWorkspaceContentProps {
  bookId: string | undefined;
  publication: AuthorPublication;
  activeChapter: ChapterDraft | undefined;
  activeTab: 'editor' | 'preview';
  selectedChapterId: string;
  assets: AuthorAssetMetadata[];
  assetsLoading: boolean;
  assetsError: boolean;
  updatedAt: string;
  sessionToken: string | null;
  setAssets: Dispatch<SetStateAction<AuthorAssetMetadata[]>>;
  onSelectChapter: (chapterId: string) => void;
  onAddChapter: () => void;
  onMoveChapter: (index: number, direction: 'up' | 'down') => void;
  onDeleteChapter: (chapterId: string) => void;
  onUpdateChapter: (updates: Partial<ChapterDraft>) => void;
  onAppendMarkup: (markup: string) => void;
  onRetryAssets: () => Promise<void>;
  onScheduleAutosave: (publication: AuthorPublication) => void;
}

const AuthorEpubPreview = lazy(() =>
  import('./components/AuthorEpubPreview').then((module) => ({
    default: module.AuthorEpubPreview,
  })),
);

function collectUsedAssetIds(publication: AuthorPublication): Set<string> {
  const assetIds = new Set<string>();
  if (publication.coverImageAssetId) assetIds.add(publication.coverImageAssetId);
  for (const id of publication.stylesheetAssetIds) assetIds.add(id);
  for (const chapter of publication.chapters) {
    const pending = [...parseAuthorContent(chapter.contentHtml)];
    while (pending.length > 0) {
      const node = pending.pop();
      if (!node || node.type !== 'element') continue;
      if (node.tag === 'img') {
        const src = node.attributes.find((attribute) => attribute.name === 'src')?.value;
        if (src?.startsWith('asset:')) assetIds.add(src.slice('asset:'.length));
      }
      for (const child of node.children) pending.push(child);
    }
  }
  return assetIds;
}

export function AuthorWorkspaceContent({
  bookId,
  publication,
  activeChapter,
  activeTab,
  selectedChapterId,
  assets,
  assetsLoading,
  assetsError,
  updatedAt,
  sessionToken,
  setAssets,
  onSelectChapter,
  onAddChapter,
  onMoveChapter,
  onDeleteChapter,
  onUpdateChapter,
  onAppendMarkup,
  onRetryAssets,
  onScheduleAutosave,
}: AuthorWorkspaceContentProps) {
  const { t } = useTranslation();
  const usedAssetIds = useMemo(() => collectUsedAssetIds(publication), [publication]);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <ChapterSidebar
        chapters={publication.chapters}
        selectedChapterId={selectedChapterId}
        onSelectChapter={onSelectChapter}
        onAddChapter={onAddChapter}
        onMoveChapter={onMoveChapter}
        onDeleteChapter={onDeleteChapter}
      />

      <div className="min-h-0 flex-1 overflow-y-auto bg-background px-4 py-5 sm:p-6">
        {activeTab === 'editor' && activeChapter ? (
          <ChapterEditor
            chapter={activeChapter}
            onUpdate={onUpdateChapter}
            onAppendMarkup={onAppendMarkup}
          />
        ) : activeTab === 'preview' ? (
          assetsLoading ? (
            <p role="status" className="text-sm text-foreground-muted">
              {t('author.assets.loading')}
            </p>
          ) : (
            <Suspense
              fallback={
                <p role="status" className="text-sm text-foreground-muted">
                  {t('author.preview.loading')}
                </p>
              }
            >
              <AuthorEpubPreview
                bookId={bookId ?? ''}
                publication={publication}
                assets={assets}
                updatedAt={updatedAt}
                token={sessionToken}
              />
            </Suspense>
          )
        ) : null}

        <div className="mx-auto mt-8 max-w-5xl">
          <AuthorAssetsPanel
            assets={assets}
            usedAssetIds={usedAssetIds}
            stylesheetAssetIds={publication.stylesheetAssetIds}
            isLoading={assetsLoading}
            loadError={assetsError}
            onRetry={() => void onRetryAssets()}
            onUpload={async (file) => {
              if (!bookId) throw new Error(t('author.assets.uploadError'));
              const asset = await uploadAuthorAsset(
                bookId,
                crypto.randomUUID(),
                file,
                sessionToken,
              );
              setAssets((current) => [...current.filter((item) => item.id !== asset.id), asset]);
            }}
            onDelete={async (assetId) => {
              if (!bookId) throw new Error(t('author.assets.deleteError'));
              await deleteAuthorAsset(bookId, assetId, sessionToken);
              setAssets((current) => current.filter((asset) => asset.id !== assetId));
            }}
            onToggleStylesheet={(assetId, included) => {
              const stylesheetAssetIds = new Set(publication.stylesheetAssetIds);
              if (included) stylesheetAssetIds.add(assetId);
              else stylesheetAssetIds.delete(assetId);
              onScheduleAutosave({
                ...publication,
                stylesheetAssetIds: [...stylesheetAssetIds],
              });
            }}
            onInsertImage={(asset) => {
              onAppendMarkup(`<img src="asset:${asset.id}" alt="${escapeHtml(asset.name)}"/>`);
            }}
          />
        </div>
      </div>
    </main>
  );
}

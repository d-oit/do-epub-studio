import { useMemo } from 'react';
import type { AuthorAssetMetadata, ChapterDraft } from '@do-epub-studio/shared';
import { parseAuthorContent } from '@do-epub-studio/reader-core/author-content';
import { FONT_SIZES, LINE_HEIGHTS, usePreferencesStore } from '../../../stores';
import { READER_PAGE_WIDTH_CLASSES } from '../../../lib/reader-page-width';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  collectAuthorImageAssetIds,
  renderAuthorPreviewContent,
  resolvePreviewDirection,
} from '../author-preview';
import { useAuthorAssetUrls } from '../useAuthorAssetUrls';

interface AuthorChapterPreviewProps {
  bookId: string;
  chapter: Pick<ChapterDraft, 'title' | 'contentHtml'>;
  language: string;
  assets: readonly AuthorAssetMetadata[];
  token?: string | null;
}

/**
 * Immediate, safe chapter preview shown beside the editor. It renders the
 * in-memory draft through the shared parser allowlist — never through
 * `dangerouslySetInnerHTML` — and applies reader typography, direction, and
 * page-width preferences.
 */
export function AuthorChapterPreview({
  bookId,
  chapter,
  language,
  assets,
  token,
}: AuthorChapterPreviewProps) {
  const { t } = useTranslation();
  const prefs = usePreferencesStore((state) => state.reader);

  const parsed = useMemo(() => {
    try {
      return parseAuthorContent(chapter.contentHtml);
    } catch {
      return null;
    }
  }, [chapter.contentHtml]);

  const assetIds = useMemo(() => (parsed ? collectAuthorImageAssetIds(parsed) : []), [parsed]);
  const assetUrls = useAuthorAssetUrls(bookId, assetIds, assets, token);
  const direction = resolvePreviewDirection(prefs.direction, language);
  const fontFamily =
    prefs.fontFamily === 'serif'
      ? 'serif'
      : prefs.fontFamily === 'sans-serif'
        ? 'sans-serif'
        : 'monospace';

  return (
    <aside
      aria-label={t('author.tabs.preview')}
      data-testid="author-chapter-preview"
      className="min-w-0 rounded-sm border border-border bg-surface p-4"
    >
      <h3 className="mb-2 truncate text-sm font-semibold text-foreground">{chapter.title}</h3>
      <div
        className={`mx-auto w-full ${READER_PAGE_WIDTH_CLASSES[prefs.pageWidth]}`}
        dir={direction}
        style={{
          fontSize: FONT_SIZES[prefs.fontSize],
          lineHeight: LINE_HEIGHTS[prefs.lineHeight] ?? '1.6',
          fontFamily,
          writingMode: prefs.writingMode,
        }}
      >
        {parsed === null ? (
          <p role="alert" className="text-sm text-semantic-error">
            {t('author.preview.error')}
          </p>
        ) : parsed.length === 0 ? (
          <p className="text-sm text-foreground-muted">{t('author.chapter.contentPlaceholder')}</p>
        ) : (
          renderAuthorPreviewContent(parsed, {
            assetUrls,
            missingImageLabel: t('author.assets.loadError'),
          })
        )}
      </div>
    </aside>
  );
}

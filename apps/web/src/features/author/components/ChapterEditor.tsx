import { useState } from 'react';
import type { ChapterDraft } from '@do-epub-studio/shared';
import { Button } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { escapeHtml } from '../author-html';

interface ChapterEditorProps {
  chapter: ChapterDraft;
  onUpdate: (updates: Partial<ChapterDraft>) => void;
  onAppendMarkup: (markup: string) => void;
}

export function ChapterEditor({ chapter, onUpdate, onAppendMarkup }: ChapterEditorProps) {
  const { t } = useTranslation();
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleInsertLink = () => {
    try {
      const url = new URL(linkUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new TypeError();
      onAppendMarkup(
        `<a href="${escapeHtml(url.href)}">${escapeHtml(t('author.chapter.linkText'))}</a>`,
      );
      setLinkUrl('');
      setLinkError(null);
    } catch {
      setLinkError(t('author.chapter.linkInvalid'));
    }
  };

  return (
    <section aria-label={t('author.tabs.editor')} className="mx-auto max-w-3xl space-y-5">
      <div>
        <label htmlFor="chapter-title-input" className="mb-1 block text-sm font-semibold">
          {t('author.chapter.title')}
        </label>
        <input
          id="chapter-title-input"
          type="text"
          value={chapter.title}
          maxLength={255}
          onChange={(event) => onUpdate({ title: event.target.value })}
          className="min-h-11 w-full rounded-sm border border-border bg-surface px-4 py-2 text-base font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>

      <fieldset className="rounded-sm border border-border bg-surface p-3">
        <legend className="px-1 text-sm font-semibold">{t('author.chapter.formatting')}</legend>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() =>
              onAppendMarkup(`<h2>${escapeHtml(t('author.chapter.heading2Text'))}</h2>`)
            }
          >
            {t('author.chapter.heading2')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() =>
              onAppendMarkup(`<h3>${escapeHtml(t('author.chapter.heading3Text'))}</h3>`)
            }
          >
            {t('author.chapter.heading3')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() =>
              onAppendMarkup(`<p>${escapeHtml(t('author.chapter.paragraphText'))}</p>`)
            }
          >
            {t('author.chapter.paragraph')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() =>
              onAppendMarkup(
                `<blockquote>${escapeHtml(t('author.chapter.quoteText'))}</blockquote>`,
              )
            }
          >
            {t('author.chapter.quote')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() =>
              onAppendMarkup(
                `<ul><li>${escapeHtml(t('author.chapter.listItemOne'))}</li><li>${escapeHtml(t('author.chapter.listItemTwo'))}</li></ul>`,
              )
            }
          >
            {t('author.chapter.list')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() =>
              onAppendMarkup(`<strong>${escapeHtml(t('author.chapter.boldText'))}</strong>`)
            }
          >
            {t('author.chapter.bold')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            onClick={() => onAppendMarkup(`<em>${escapeHtml(t('author.chapter.italicText'))}</em>`)}
          >
            {t('author.chapter.italic')}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="chapter-link-url" className="mb-1 block text-sm font-medium">
              {t('author.chapter.linkUrl')}
            </label>
            <input
              id="chapter-link-url"
              type="url"
              value={linkUrl}
              aria-describedby={linkError ? 'chapter-link-error' : undefined}
              onChange={(event) => {
                setLinkUrl(event.target.value);
                setLinkError(null);
              }}
              className="min-h-11 w-full rounded-sm border border-border bg-background px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            {linkError && (
              <p id="chapter-link-error" className="mt-1 text-sm text-semantic-error" role="alert">
                {linkError}
              </p>
            )}
          </div>
          <Button type="button" variant="secondary" className="min-h-11" onClick={handleInsertLink}>
            {t('author.chapter.link')}
          </Button>
        </div>
      </fieldset>

      <div>
        <label htmlFor="chapter-body-editor" className="mb-1 block text-sm font-semibold">
          {t('author.chapter.content')}
        </label>
        <p id="chapter-content-hint" className="mb-2 text-sm text-foreground-muted">
          {t('author.chapter.contentHint')}
        </p>
        <textarea
          id="chapter-body-editor"
          rows={18}
          value={chapter.contentHtml}
          onChange={(event) => onUpdate({ contentHtml: event.target.value })}
          placeholder={t('author.chapter.contentPlaceholder')}
          aria-describedby="chapter-content-hint"
          className="min-h-80 w-full rounded-sm border border-border bg-surface p-4 font-mono text-base leading-relaxed text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>
    </section>
  );
}

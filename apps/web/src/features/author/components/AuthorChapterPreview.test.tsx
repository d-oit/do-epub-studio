import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { AuthorAssetMetadata, ChapterDraft } from '@do-epub-studio/shared';
import { usePreferencesStore } from '../../../stores';
import { AuthorChapterPreview } from './AuthorChapterPreview';

const mocks = vi.hoisted(() => ({
  useAuthorAssetUrls: vi.fn(() => new Map<string, string>()),
  translate: (key: string) => key,
}));

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mocks.translate }),
}));

vi.mock('../useAuthorAssetUrls', () => ({
  useAuthorAssetUrls: mocks.useAuthorAssetUrls,
}));

const IMAGE_ID = '11111111-1111-4111-8111-111111111111';
const UNUSED_ID = '44444444-4444-4444-8444-444444444444';

function asset(id: string): AuthorAssetMetadata {
  return {
    id,
    name: `${id}.png`,
    mediaType: 'image/png',
    sizeBytes: 10,
    sha256: 'a'.repeat(64),
    createdAt: '2026-11-05T12:00:00.000Z',
  };
}

const ASSETS = [asset(IMAGE_ID), asset(UNUSED_ID)];
const CHAPTER: Pick<ChapterDraft, 'title' | 'contentHtml'> = {
  title: 'Chapter one',
  contentHtml: '',
};

function renderPreview(
  chapter: Pick<ChapterDraft, 'title' | 'contentHtml'> = CHAPTER,
  language = 'en',
) {
  return render(
    <AuthorChapterPreview
      bookId="book-1"
      chapter={chapter}
      language={language}
      assets={ASSETS}
      token="token-1"
    />,
  );
}

function previewDiv() {
  const aside = screen.getByTestId('author-chapter-preview');
  const inner = aside.querySelector('div[dir]');
  if (!inner) throw new Error('expected the preview content div');
  return inner;
}

beforeEach(() => {
  vi.clearAllMocks();
  usePreferencesStore.setState({
    reader: {
      theme: 'system',
      fontFamily: 'serif',
      fontSize: 'medium',
      lineHeight: 2,
      pageWidth: 'normal',
      direction: 'default',
      writingMode: 'horizontal-tb',
      aiEnabled: false,
    },
  });
  mocks.useAuthorAssetUrls.mockReturnValue(new Map([[IMAGE_ID, 'blob:mock-image']]));
});

describe('AuthorChapterPreview', () => {
  it('renders the chapter title and sanitized content', () => {
    renderPreview({ title: 'Chapter one', contentHtml: '<p>Visible preview text</p>' });
    expect(screen.getByRole('heading', { name: 'Chapter one' })).toBeVisible();
    expect(screen.getByText('Visible preview text')).toBeVisible();
  });

  it('reflects live edits without waiting for autosave', () => {
    const { rerender } = renderPreview();
    act(() => {
      rerender(
        <AuthorChapterPreview
          bookId="book-1"
          chapter={{ title: 'Chapter one', contentHtml: '<p>Live text</p>' }}
          language="en"
          assets={ASSETS}
          token="token-1"
        />,
      );
    });
    expect(screen.getByText('Live text')).toBeVisible();
    expect(screen.queryByText('author.chapter.contentPlaceholder')).toBeNull();
  });

  it('never executes scripts and drops disallowed content', () => {
    renderPreview({
      title: 'Chapter one',
      contentHtml: '<p>Safe</p><script>window.__unsafe=1</script><iframe src="x"></iframe>',
    });
    expect(screen.getByText('Safe')).toBeVisible();
    expect(screen.queryByText('window.__unsafe=1')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('renders referenced images with resolved URLs and fetches only referenced ids', () => {
    renderPreview({
      title: 'Chapter one',
      contentHtml: `<img src="asset:${IMAGE_ID}" alt="Diagram">`,
    });
    const image = screen.getByRole('img', { name: 'Diagram' });
    expect(image).toHaveAttribute('src', 'blob:mock-image');
    expect(mocks.useAuthorAssetUrls).toHaveBeenCalledWith('book-1', [IMAGE_ID], ASSETS, 'token-1');
  });

  it('shows an accessible placeholder when a referenced image is unavailable', () => {
    mocks.useAuthorAssetUrls.mockReturnValue(new Map());
    renderPreview({
      title: 'Chapter one',
      contentHtml: `<img src="asset:${IMAGE_ID}" alt="Gone">`,
    });
    const placeholder = screen.getByRole('img', { name: 'Gone' });
    // Never a real <img> with a dead src: the accessible text placeholder stands in.
    expect(placeholder.tagName).not.toBe('IMG');
    expect(placeholder.textContent).toBe('Gone');
  });

  it('renders an empty state for empty content', () => {
    renderPreview();
    expect(screen.getByText('author.chapter.contentPlaceholder')).toBeVisible();
  });

  it('applies RTL direction from the publication language without an explicit override', () => {
    renderPreview({ title: 'الفصل', contentHtml: '<p>نص</p>' }, 'ar');
    expect(previewDiv()).toHaveAttribute('dir', 'rtl');
  });

  it('lets an explicit reader direction override win over the language', () => {
    act(() => {
      usePreferencesStore.setState({
        reader: { ...usePreferencesStore.getState().reader, direction: 'ltr' },
      });
    });
    renderPreview({ title: 'الفصل', contentHtml: '<p>نص</p>' }, 'ar');
    expect(previewDiv()).toHaveAttribute('dir', 'ltr');
  });

  it('applies reader typography and page-width preferences', () => {
    act(() => {
      usePreferencesStore.setState({
        reader: {
          ...usePreferencesStore.getState().reader,
          fontSize: 'large',
          lineHeight: 3,
          fontFamily: 'monospace',
          pageWidth: 'narrow',
          writingMode: 'vertical-rl',
        },
      });
    });
    renderPreview({ title: 'Chapter one', contentHtml: '<p>Text</p>' });
    const inner = previewDiv();
    expect(inner).toHaveStyle({
      fontSize: '18px',
      lineHeight: '1.8',
      fontFamily: 'monospace',
      writingMode: 'vertical-rl',
    });
    expect(inner.className).toContain('max-w-xl');
  });
});

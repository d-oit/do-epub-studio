import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { parseAuthorContent } from '@do-epub-studio/reader-core/author-content';
import {
  collectAuthorImageAssetIds,
  renderAuthorPreviewContent,
  resolvePreviewDirection,
  type RenderAuthorPreviewOptions,
} from './author-preview';

const IMAGE_ID = '11111111-1111-4111-8111-111111111111';
const IMAGE_ID_2 = '22222222-2222-4222-8222-222222222222';

function renderPreview(content: string, options?: Partial<RenderAuthorPreviewOptions>) {
  return render(
    <div>
      {renderAuthorPreviewContent(parseAuthorContent(content), {
        assetUrls: new Map([
          [IMAGE_ID, 'blob:mock-image'],
          [IMAGE_ID_2, 'blob:mock-image-2'],
        ]),
        missingImageLabel: 'Missing image',
        ...options,
      })}
    </div>,
  );
}

describe('collectAuthorImageAssetIds', () => {
  it('collects unique referenced asset ids in document order', () => {
    const nodes = parseAuthorContent(
      `<p><img src="asset:${IMAGE_ID_2}" alt="a"><img src="asset:${IMAGE_ID}" alt="b">` +
        `<img src="asset:${IMAGE_ID_2}" alt="c"><img src="https://example.com/x.png" alt="d"></p>`,
    );
    expect(collectAuthorImageAssetIds(nodes)).toEqual([IMAGE_ID_2, IMAGE_ID]);
  });

  it('returns an empty list when nothing references an asset', () => {
    expect(collectAuthorImageAssetIds(parseAuthorContent('<p>plain text</p>'))).toEqual([]);
  });
});

describe('resolvePreviewDirection', () => {
  it('lets an explicit reader override win', () => {
    expect(resolvePreviewDirection('rtl', 'en')).toBe('rtl');
    expect(resolvePreviewDirection('ltr', 'ar')).toBe('ltr');
  });

  it('treats RTL primary subtags as RTL and everything else as LTR', () => {
    expect(resolvePreviewDirection('default', 'ar')).toBe('rtl');
    expect(resolvePreviewDirection('default', 'fa-IR')).toBe('rtl');
    expect(resolvePreviewDirection('default', 'he')).toBe('rtl');
    expect(resolvePreviewDirection('default', 'en-GB')).toBe('ltr');
    expect(resolvePreviewDirection('default', undefined)).toBe('ltr');
  });
});

describe('renderAuthorPreviewContent', () => {
  it('renders text nodes through React escaping', () => {
    const { container } = renderPreview('<p>&lt;script&gt;window.x=1&lt;/script&gt;</p>');
    expect(container.textContent).toContain('<script>window.x=1</script>');
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders referenced images with their object URL and alt text', () => {
    const { container } = renderPreview(`<img src="asset:${IMAGE_ID}" alt="Diagram">`);
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute('src', 'blob:mock-image');
    expect(image).toHaveAttribute('alt', 'Diagram');
  });

  it('renders a visible accessible placeholder for missing images', () => {
    const { container } = renderPreview(
      '<img src="asset:99999999-9999-4999-8999-999999999999" alt="Gone">',
    );
    expect(container.querySelector('img')).toBeNull();
    const placeholder = container.querySelector('[role="img"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveAttribute('aria-label', 'Gone');
    expect(placeholder?.textContent).toBe('Gone');
  });

  it('falls back to the localized label when a missing image has no alt', () => {
    const { container } = renderPreview('<img src="asset:99999999-9999-4999-8999-999999999999">', {
      missingImageLabel: 'Unavailable image',
    });
    expect(container.querySelector('[role="img"]')).toHaveAttribute(
      'aria-label',
      'Unavailable image',
    );
  });

  it('keeps mailto links active', () => {
    const { container } = renderPreview('<a href="mailto:a@example.com">Email</a>');
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('href', 'mailto:a@example.com');
    expect(link?.textContent).toBe('Email');
  });

  it('rewrites local fragment links and ids into the preview namespace', () => {
    const { container } = renderPreview('<a href="#note-1">Jump</a><p id="note-1">Note</p>');
    expect(container.querySelector('a')).toHaveAttribute('href', '#author-preview-note-1');
    expect(container.querySelector('p')).toHaveAttribute('id', 'author-preview-note-1');
  });

  it('renders other relative links as inert text', () => {
    const { container } = renderPreview('<a href="../next.xhtml">Next chapter</a>');
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('Next chapter');
  });

  it('never emits HTTP(S) anchors because the parser strips them', () => {
    const { container } = renderPreview(
      '<a href="https://evil.example">External</a><a href="http://x">Also</a>',
    );
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).not.toContain('External');
  });

  it('maps table cell spans to React casing and rewrites headers references', () => {
    const { container } = renderPreview(
      `<table><thead><tr><th id="h-1" scope="col">H</th></tr></thead>` +
        `<tbody><tr><td colspan="2" rowspan="3" headers="h-1">Cell</td></tr></tbody></table>`,
    );
    const header = container.querySelector('th');
    const cell = container.querySelector('td');
    expect(header).toHaveAttribute('scope', 'col');
    expect(header).toHaveAttribute('id', 'author-preview-h-1');
    expect(cell).toHaveAttribute('colspan', '2');
    expect(cell).toHaveAttribute('rowspan', '3');
    expect(cell).toHaveAttribute('headers', 'author-preview-h-1');
  });

  it('drops author classes to avoid app-style collisions', () => {
    const { container } = renderPreview('<p class="highlight custom">Text</p>');
    expect(container.querySelector('p')).not.toHaveAttribute('class');
  });

  it('renders void tags without children', () => {
    const { container } = renderPreview('<p>one<br>two<hr></p>');
    expect(container.querySelector('br')).not.toBeNull();
    expect(container.querySelector('hr')).not.toBeNull();
    expect(container.textContent).toBe('onetwo');
  });
});

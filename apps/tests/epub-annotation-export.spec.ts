import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createMinimalEpub, loginAsReader, mockReaderApi } from './fixtures';

const SOURCE_TEXT = 'Unique source sentence from the original chapter.';
const SOURCE_CFI = 'epubcfi(/6/2[chapter]!/4/4/1:0)';

async function readerFrameContains(page: Page, text: string): Promise<boolean> {
  const frameTexts = await Promise.all(
    page
      .frames()
      .slice(1)
      .map((frame) =>
        frame
          .locator('body')
          .textContent()
          .catch(() => ''),
      ),
  );
  return frameTexts.some((frameText) => frameText?.includes(text));
}

test('opens the annotation appendix and follows an intra-publication CFI link', async ({
  page,
}) => {
  const epubBuffer = createMinimalEpub(
    [
      {
        id: 'chapter',
        href: 'chapter.xhtml',
        title: 'Chapter One',
        body: `<h1>Chapter One</h1><p>${SOURCE_TEXT}</p>`,
      },
      {
        id: 'annotations',
        href: 'annotations.xhtml',
        title: 'Annotations',
        body: `<h1>Annotations</h1><section><h2>Highlight</h2><blockquote><p>Quoted phrase shown in the appendix.</p></blockquote><a href="content.opf#${encodeURI(SOURCE_CFI)}">Open source location</a></section><section><h2>Comment</h2><p>Location unresolved</p><blockquote>Stale source context.</blockquote><p>This unresolved comment remains available.</p></section>`,
      },
    ],
    {
      title: 'Annotation export reader smoke',
      identifier: 'urn:uuid:14320000-0000-4000-8000-000000000001',
    },
  );
  await mockReaderApi(page, { epubBuffer });
  await loginAsReader(page);

  await expect.poll(() => readerFrameContains(page, SOURCE_TEXT), { timeout: 15_000 }).toBe(true);
  const frame = page.frameLocator('[data-epub-content-host] iframe').first();
  const toc = page.getByTestId('toc-list');
  await page.getByRole('button', { name: 'Contents' }).click();
  const appendix = toc.getByRole('button', { name: 'Annotations' });
  await expect(appendix).toBeVisible();
  await appendix.click();
  await expect(frame.getByRole('heading', { level: 1, name: 'Annotations' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(frame.getByText('Location unresolved')).toBeVisible();
  await expect.poll(() => readerFrameContains(page, SOURCE_TEXT)).toBe(false);

  const sourceLink = frame.getByRole('link', { name: 'Open source location' });
  await expect(sourceLink).toHaveAttribute('href', /content\.opf#epubcfi/);
  await sourceLink.click();
  await expect.poll(() => readerFrameContains(page, SOURCE_TEXT), { timeout: 15_000 }).toBe(true);
});

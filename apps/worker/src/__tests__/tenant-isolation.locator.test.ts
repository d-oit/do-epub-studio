import { describe, expect, it } from 'vitest';
import { parseLocatorRow } from '../lib/tenant-isolation';
import { makeEnv, makePassThroughContext } from './fixtures';

const env = makeEnv();
const ctx = makePassThroughContext();

describe('parseLocatorRow schema selection', () => {
  it('accepts a position-only bookmark locator and keeps its chapter hint', async () => {
    const parsed = await parseLocatorRow(
      env,
      JSON.stringify({ cfi: 'epubcfi(/6/4!/4/2/1:0)', chapterRef: 'chapter2.xhtml' }),
      { entityType: 'bookmark', entityId: 'bm-1', bookId: 'book-1' },
      ctx,
    );

    expect(parsed).toEqual({ cfi: 'epubcfi(/6/4!/4/2/1:0)', chapterRef: 'chapter2.xhtml' });
  });

  it('accepts a CFI-only progress locator', async () => {
    const parsed = await parseLocatorRow(
      env,
      JSON.stringify({ cfi: 'epubcfi(/6/4!/4/2/1:0)' }),
      { entityType: 'progress', entityId: 'progress-1', bookId: 'book-1' },
      ctx,
    );

    expect(parsed).toEqual({ cfi: 'epubcfi(/6/4!/4/2/1:0)' });
  });

  it('still requires the full multi-signal locator for highlights', async () => {
    const parsed = await parseLocatorRow(
      env,
      JSON.stringify({ cfi: 'epubcfi(/6/4!/4/2/1:0)' }),
      { entityType: 'highlight', entityId: 'hl-1', bookId: 'book-1' },
      ctx,
    );

    expect(parsed).toBeNull();
  });
});

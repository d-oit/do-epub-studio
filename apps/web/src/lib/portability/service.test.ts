import { describe, expect, it } from 'vitest';
import { buildExportEnvelope, collectPaged } from './service';

describe('collectPaged', () => {
  it('fetches every page until a short one', async () => {
    const calls: Array<[number, number]> = [];
    const fetcher = (limit: number, offset: number) => {
      calls.push([limit, offset]);
      return Promise.resolve(offset === 0 ? Array.from({ length: limit }, (_, i) => i) : [offset]);
    };

    const items = await collectPaged(fetcher, 3);
    expect(items).toEqual([0, 1, 2, 3]);
    expect(calls).toEqual([
      [3, 0],
      [3, 3],
    ]);
  });

  it('stops immediately on an empty first page', async () => {
    const items = await collectPaged(() => Promise.resolve([]), 10);
    expect(items).toEqual([]);
  });

  it('propagates cancellation before the next request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      collectPaged(() => Promise.resolve([1]), 10, controller.signal),
    ).rejects.toHaveProperty('name', 'AbortError');
  });
});

const book = {
  id: 'book-1',
  slug: 'my-book',
  title: 'My Book',
  authorName: null,
  visibility: 'private',
  coverImageUrl: null,
  description: null,
  language: 'en',
  progressPercent: 0,
  progressUpdatedAt: null,
};

const states = {
  'book-1': {
    highlights: [],
    comments: [],
    bookmarks: [],
    progress: {
      locator: null,
      progressPercent: 0,
      updatedAt: null,
      revision: 0,
    },
  },
};

const preferences = {
  theme: 'dark' as const,
  fontFamily: 'serif' as const,
  fontSize: 'medium' as const,
  lineHeight: 2 as const,
  pageWidth: 'normal' as const,
  direction: 'default' as const,
  writingMode: 'horizontal-tb' as const,
  aiEnabled: false,
};

describe('buildExportEnvelope', () => {
  it('embeds preferences only for account-scope exports, never book scope', async () => {
    const account = await buildExportEnvelope({
      scope: 'account',
      books: [book],
      states,
      preferences,
    });
    const prefsItems = account.items.filter((i) => i.type === 'preferences');
    expect(prefsItems).toHaveLength(1);

    const bookScope = await buildExportEnvelope({
      scope: 'book',
      books: [book],
      states,
      // Passed on purpose: must be ignored for book scope.
      preferences,
    });
    expect(bookScope.items.filter((i) => i.type === 'preferences')).toHaveLength(0);
  });

  it('omits preferences when none are supplied', async () => {
    const envelope = await buildExportEnvelope({
      scope: 'account',
      books: [book],
      states,
    });
    expect(envelope.items.filter((i) => i.type === 'preferences')).toHaveLength(0);
  });
});

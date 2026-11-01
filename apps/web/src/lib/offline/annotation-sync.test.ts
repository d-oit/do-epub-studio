import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequest } = vi.hoisted(() => ({
  apiRequest: vi.fn().mockResolvedValue({ id: 'bm-1' }),
}));
vi.mock('../api', () => ({ apiRequest }));
vi.mock('../api/annotations', () => ({ createHighlight: vi.fn(), createComment: vi.fn() }));
vi.mock('./session', () => ({ requireSessionToken: () => 'session-token' }));

import { syncAnnotation } from './annotation-sync';
import type { SyncQueueItem } from './db';

function bookmarkItem(annotation: { cfi: string; chapter?: string; text?: string }): SyncQueueItem {
  return {
    id: 'queue-1',
    type: 'annotation',
    mutationId: '11111111-1111-4111-8111-111111111111',
    attempts: 0,
    createdAt: 1,
    payload: {
      bookId: 'book-1',
      annotation: {
        id: 'local-1',
        bookId: 'book-1',
        type: 'bookmark',
        createdAt: 1,
        synced: false,
        mutationId: '11111111-1111-4111-8111-111111111111',
        ...annotation,
      },
    },
  };
}

describe('syncAnnotation (bookmark replay)', () => {
  beforeEach(() => {
    apiRequest.mockClear();
  });

  it('replays a position-only bookmark without fabricating selected text', async () => {
    await syncAnnotation(
      bookmarkItem({
        cfi: 'epubcfi(/6/4!/4/2/1:0)',
        chapter: 'chapter2.xhtml',
        text: 'Try annotations',
      }),
    );

    expect(apiRequest).toHaveBeenCalledTimes(1);
    const [endpoint, options] = apiRequest.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(endpoint).toBe('/api/books/book-1/bookmarks');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      mutationId: '11111111-1111-4111-8111-111111111111',
      locator: { cfi: 'epubcfi(/6/4!/4/2/1:0)', chapterRef: 'chapter2.xhtml' },
      label: 'Try annotations',
    });
  });

  it('omits an unknown chapter instead of sending an empty string', async () => {
    await syncAnnotation(bookmarkItem({ cfi: 'epubcfi(/6/4!/4/2/1:0)' }));

    const [, options] = apiRequest.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(options.body) as { locator: Record<string, string> };
    expect(body.locator).toEqual({ cfi: 'epubcfi(/6/4!/4/2/1:0)' });
    expect(body.locator).not.toHaveProperty('chapterRef');
  });
});

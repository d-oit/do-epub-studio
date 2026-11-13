import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../lib/env';

const mocks = vi.hoisted(() => ({
  queryFirst: vi.fn(),
  execute: vi.fn(),
  clearBookSearchIndex: vi.fn(),
  replaceBookSearchIndex: vi.fn(),
}));

vi.mock('../db/client', () => ({
  queryFirst: mocks.queryFirst,
  execute: mocks.execute,
}));
vi.mock('../lib/book-search-index', () => ({
  clearBookSearchIndex: mocks.clearBookSearchIndex,
  replaceBookSearchIndex: mocks.replaceBookSearchIndex,
}));

import { finalizeBookEpubRevision } from '../lib/epub-revisions';

const revision = {
  bookId: 'book-1',
  fileId: 'revision-1',
  storageKey: 'books/book-1/revisions/revision-1.epub',
  originalFilename: 'book.epub',
  mimeType: 'application/epub+zip',
  fileSizeBytes: 128,
  sha256: 'a'.repeat(64),
  createdAt: '2026-01-01T00:00:00.000Z',
};

function makeEnv(send: ReturnType<typeof vi.fn>): Env {
  return {
    EPUB_VALIDATION_QUEUE: { send },
  } as unknown as Env;
}

describe('finalizeBookEpubRevision validation enqueue policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockResolvedValue({ rows: [] });
    mocks.clearBookSearchIndex.mockResolvedValue(undefined);
    mocks.replaceBookSearchIndex.mockResolvedValue(undefined);
  });

  it('enqueues validation once for a newly inserted immutable revision', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    mocks.queryFirst.mockResolvedValueOnce({ id: revision.fileId }).mockResolvedValueOnce(null);

    const result = await finalizeBookEpubRevision(makeEnv(send), revision);

    expect(result).toEqual({ inserted: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ bookId: revision.bookId, revisionId: revision.fileId });
  });

  it('does not enqueue again when an existing revision still has a pending report', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    mocks.queryFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'report-1', status: 'pending' });

    const result = await finalizeBookEpubRevision(makeEnv(send), revision);

    expect(result).toEqual({ inserted: false });
    expect(send).not.toHaveBeenCalled();
  });
});

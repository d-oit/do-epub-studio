import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makeRequest,
  makeAuthContext,
  makeProgressRow,
  makeBookmarkRow,
  makeHighlightRow,
  mockQueryFirst,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
} from './fixtures';
import {
  handleGetProgress,
  handleUpdateProgress,
  handleListBookmarks,
  handleCreateBookmark,
  handleDeleteBookmark,
  handleListHighlights,
  handleCreateHighlight,
  handleDeleteHighlight,
  handleUpdateHighlight,
} from '../routes/reader-state';

describe('GET /api/reader-state/{bookId}/progress (handleGetProgress)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleGetProgress(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(401);
  });

  it('returns null progress when no record exists', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockReturnValue(Promise.resolve(null) as never);

    const res = await handleGetProgress(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.locator).toBeNull();
    expect(body.data.progressPercent).toBe(0);
  });

  it('returns progress when record exists', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue(makeProgressRow() as never);

    const res = await handleGetProgress(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.progressPercent).toBe(50);
  });
});

describe('POST /api/reader-state/{bookId}/progress (handleUpdateProgress)', () => {
  const validBody = {
    locator: { cfi: 'epubcfi(/6/4)', selectedText: 'test' },
    progressPercent: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleUpdateProgress(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user cannot read', async () => {
    mockRequireAuth.mockResolvedValue(
      makeAuthContext({
        capabilities: {
          canRead: false,
          canComment: false,
          canHighlight: false,
          canBookmark: false,
          canDownloadOffline: false,
          canExportNotes: false,
          canManageAccess: false,
        },
      }),
    );
    const res = await handleUpdateProgress(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(403);
  });

  it('updates progress and returns success', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExecute.mockResolvedValue({} as never);

    const res = await handleUpdateProgress(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.progressPercent).toBe(50);
  });
});

describe('GET /api/reader-state/{bookId}/bookmarks (handleListBookmarks)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleListBookmarks(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no bookmarks exist', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([] as never);

    const res = await handleListBookmarks(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('returns list of bookmarks', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([makeBookmarkRow()] as never);

    const res = await handleListBookmarks(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
  });
});

describe('POST /api/reader-state/{bookId}/bookmarks (handleCreateBookmark)', () => {
  const validBody = {
    locator: { cfi: 'epubcfi(/6/4)', selectedText: 'text' },
    label: 'My Bookmark',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleCreateBookmark(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user cannot bookmark', async () => {
    mockRequireAuth.mockResolvedValue(
      makeAuthContext({
        capabilities: {
          canRead: true,
          canComment: false,
          canHighlight: false,
          canBookmark: false,
          canDownloadOffline: false,
          canExportNotes: false,
          canManageAccess: false,
        },
      }),
    );
    const res = await handleCreateBookmark(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(403);
  });

  it('creates bookmark and returns success', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExecute.mockResolvedValue({} as never);

    const res = await handleCreateBookmark(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('DELETE /api/reader-state/{bookId}/bookmarks/{bookmarkId} (handleDeleteBookmark)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleDeleteBookmark(makeEnv(), makeRequest(), 'book-1', 'bm-1');
    expect(res.status).toBe(401);
  });

  it('deletes bookmark and returns ok', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExecute.mockResolvedValue({} as never);

    const res = await handleDeleteBookmark(makeEnv(), makeRequest(), 'book-1', 'bm-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('GET /api/reader-state/{bookId}/highlights (handleListHighlights)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleListHighlights(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no highlights', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([] as never);

    const res = await handleListHighlights(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('returns list of highlights', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([makeHighlightRow()] as never);

    const res = await handleListHighlights(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
  });
});

describe('POST /api/reader-state/{bookId}/highlights (handleCreateHighlight)', () => {
  const validBody = {
    selectedText: 'Important passage',
    cfiRange: 'epubcfi(/6/4)',
    chapterRef: 'Chapter 1',
    color: '#00ff00',
    note: 'My note',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleCreateHighlight(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user cannot highlight', async () => {
    mockRequireAuth.mockResolvedValue(
      makeAuthContext({
        capabilities: {
          canRead: true,
          canComment: false,
          canHighlight: false,
          canBookmark: false,
          canDownloadOffline: false,
          canExportNotes: false,
          canManageAccess: false,
        },
      }),
    );
    const res = await handleCreateHighlight(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(403);
  });

  it('creates highlight and returns success', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExecute.mockResolvedValue({} as never);

    const res = await handleCreateHighlight(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('DELETE /api/reader-state/{bookId}/highlights/{highlightId} (handleDeleteHighlight)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleDeleteHighlight(makeEnv(), makeRequest(), 'book-1', 'hl-1');
    expect(res.status).toBe(401);
  });

  it('deletes highlight and returns ok', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExecute.mockResolvedValue({} as never);

    const res = await handleDeleteHighlight(makeEnv(), makeRequest(), 'book-1', 'hl-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('PATCH /api/reader-state/{bookId}/highlights/{highlightId} (handleUpdateHighlight)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleUpdateHighlight(makeEnv(), makeRequest(), 'book-1', 'hl-1', { note: 'updated' });
    expect(res.status).toBe(401);
  });

  it('returns 404 when highlight not found', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue(null as never);

    const res = await handleUpdateHighlight(makeEnv(), makeRequest(), 'book-1', 'hl-1', { note: 'updated' });
    expect(res.status).toBe(404);
  });

  it('updates highlight and returns success', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue(makeHighlightRow() as never);
    mockExecute.mockResolvedValue({} as never);

    const res = await handleUpdateHighlight(makeEnv(), makeRequest(), 'book-1', 'hl-1', { note: 'updated' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

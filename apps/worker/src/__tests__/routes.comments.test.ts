import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makeRequest,
  makeAuthContext,
  makeCommentRow,
  mockQueryFirst,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
} from './fixtures';
import { handleListComments, handleCreateComment, handleUpdateComment } from '../routes/comments';

describe('GET /api/comments/{bookId} (handleListComments)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleListComments(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(401);
  });

  it('returns empty threaded comments', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([] as never);

    const res = await handleListComments(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('returns threaded comments structure', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([makeCommentRow()] as never);

    const res = await handleListComments(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
  });
});

describe('POST /api/comments/{bookId} (handleCreateComment)', () => {
  const validBody = {
    body: 'This is a comment',
    chapterRef: 'Chapter 1',
    cfiRange: 'epubcfi(/6/4)',
    visibility: 'shared' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleCreateComment(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user cannot comment', async () => {
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
    const res = await handleCreateComment(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(403);
  });

  it('creates comment and returns success', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExecute.mockResolvedValue({} as never);

    const res = await handleCreateComment(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('PATCH /api/comments/{commentId} (handleUpdateComment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleUpdateComment(makeEnv(), makeRequest(), 'comment-1', { body: 'updated' });
    expect(res.status).toBe(401);
  });

  it('returns 404 when comment not found', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue(null as never);

    const res = await handleUpdateComment(makeEnv(), makeRequest(), 'comment-1', { body: 'updated' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when user does not own comment', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ email: 'other@example.com' }));
    mockQueryFirst.mockResolvedValue(makeCommentRow({ user_email: 'user@example.com' }) as never);

    const res = await handleUpdateComment(makeEnv(), makeRequest(), 'comment-1', { body: 'updated' });
    expect(res.status).toBe(403);
  });

  it('updates comment and returns success', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue(makeCommentRow() as never);
    mockExecute.mockResolvedValue({} as never);

    const res = await handleUpdateComment(makeEnv(), makeRequest(), 'comment-1', { body: 'updated' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

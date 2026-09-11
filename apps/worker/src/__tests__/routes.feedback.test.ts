import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  makeEnv,
  makeAuthContext,
  makePassThroughContext,
  mockQueryFirst,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
  mockGetGrantByBookAndSession,
  mockComputeCapabilities,
} from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({
  parseLocatorRow: vi.fn(),
  assertBookAccess: vi.fn(),
}));

const mockAssertBookAccess = assertBookAccess as Mock;

const env = makeEnv();

const FEEDBACK_BODY = {
  kind: 'suggestion',
  category: 'grammar',
  body: 'Consider a comma here.',
  proposedText: 'Consider, a comma here.',
  anchor: { selectedText: 'Consider a comma here.' },
  mutationId: '11111111-1111-4111-8111-111111111111',
};

function postFeedback(overrides: Record<string, unknown> = {}) {
  return app.fetch(new Request('http://localhost/api/books/book-1/feedback', {
    method: 'POST',
    body: JSON.stringify({ ...FEEDBACK_BODY, ...overrides }),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
  }), env, makePassThroughContext());
}

describe('Editorial Feedback Routes (reader)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
  });

  it('creates private feedback for a contributor (201)', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce(null); // no existing mutation
    mockQueryFirst.mockResolvedValueOnce({ // re-read after insert
      id: 'fb-1', book_id: 'book-1', kind: 'suggestion', category: 'grammar',
      body: FEEDBACK_BODY.body, proposed_text: FEEDBACK_BODY.proposedText,
      book_file_id: null, source_sha256: null, chapter_ref: null, cfi: null,
      selected_text: 'Consider a comma here.', prefix: null, suffix: null,
      submitter_email: 'user@example.com', status: 'open',
      created_at: 'now', updated_at: 'now',
    });

    const res = await postFeedback();
    expect(res.status).toBe(201);
    const payload: { data: Record<string, unknown> } = await res.json();
    expect(payload.data.status).toBe('open');
    expect(payload.data).not.toHaveProperty('submitterEmail');
    // Private channel: insert pins visibility to private for this submitter.
    const insert = mockExecute.mock.calls.find((args) =>
      String(args[1]).includes('INSERT INTO editorial_feedback'));
    expect(insert?.[1]).toMatch(/'private'/);
    expect(insert?.[2]).toContain('user@example.com');
  });

  it('rejects submission from a read-only session (403)', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({
      capabilities: { ...makeAuthContext().capabilities, canComment: false },
    }));

    const res = await postFeedback();
    expect(res.status).toBe(403);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('replays the same mutationId to the existing item (no duplicate)', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce({ // existing mutation row
      id: 'fb-1', book_id: 'book-1', kind: 'comment', category: 'general',
      body: 'x', proposed_text: null, book_file_id: null, source_sha256: null,
      chapter_ref: null, cfi: null, selected_text: 'x', prefix: null, suffix: null,
      submitter_email: 'user@example.com', status: 'open',
      created_at: 'now', updated_at: 'now',
    });
    mockQueryAll.mockResolvedValueOnce([]); // replies

    const res = await postFeedback({ kind: 'comment', proposedText: undefined });
    expect(res.status).toBe(200);
    const inserts = mockExecute.mock.calls.filter((args) =>
      String(args[1]).includes('INSERT INTO editorial_feedback'));
    expect(inserts).toHaveLength(0);
  });

  it('rejects a replay bound to another book or submitter (403)', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce({
      id: 'fb-9', book_id: 'book-2', submitter_email: 'other@example.com', status: 'open',
    });

    const res = await postFeedback();
    expect(res.status).toBe(403);
  });

  it('rejects an anchor file from another book (400)', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce(null); // no existing mutation
    mockQueryFirst.mockResolvedValueOnce({ book_id: 'book-2', sha256: 'abc' }); // file row

    const res = await postFeedback({
      anchor: { selectedText: 'x', bookFileId: '22222222-2222-4222-8222-222222222222' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects a suggestion without proposedText (400)', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());

    const res = await postFeedback({ proposedText: undefined });
    expect(res.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('lists only the caller’s own items', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValueOnce([
      { id: 'fb-1', book_id: 'book-1', submitter_email: 'user@example.com', status: 'open' },
    ]);
    mockQueryFirst.mockResolvedValueOnce({ n: 0 }); // reply count

    const res = await app.fetch(new Request('http://localhost/api/books/book-1/feedback', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const sql = String(mockQueryAll.mock.calls[0][1]);
    expect(sql).toMatch(/submitter_email = \?/);
    expect(mockQueryAll.mock.calls[0][2]).toContain('user@example.com');
  });

  it('returns 404 (not 403) for another reader’s item', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce(null); // no own row

    const res = await app.fetch(new Request('http://localhost/api/books/book-1/feedback/fb-9', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(404);
  });

  it('withdraws an own item (withdrawn is terminal for creators to touch)', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce({ // own row
      id: 'fb-1', book_id: 'book-1', submitter_email: 'user@example.com', status: 'open',
    });
    mockQueryFirst.mockResolvedValueOnce({ // re-read
      id: 'fb-1', book_id: 'book-1', kind: 'comment', category: 'general', body: 'x',
      proposed_text: null, book_file_id: null, source_sha256: null, chapter_ref: null,
      cfi: null, selected_text: 'x', prefix: null, suffix: null,
      submitter_email: 'user@example.com', status: 'withdrawn',
      created_at: 'now', updated_at: 'now',
    });
    mockQueryAll.mockResolvedValueOnce([]);

    const res = await app.fetch(new Request('http://localhost/api/books/book-1/feedback/fb-1/withdraw', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const payload: { data: { status: string } } = await res.json();
    expect(payload.data.status).toBe('withdrawn');
  });

  it('refuses replies on withdrawn items (422)', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce({
      id: 'fb-1', book_id: 'book-1', submitter_email: 'user@example.com', status: 'withdrawn',
    });

    const res = await app.fetch(new Request('http://localhost/api/books/book-1/feedback/fb-1/replies', {
      method: 'POST',
      body: JSON.stringify({ body: 'follow-up' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(422);
  });

  it('re-resolves cross-book capability on replay-shaped requests', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'other-book' }));
    mockGetGrantByBookAndSession.mockResolvedValue({ id: 'grant-9' });
    mockComputeCapabilities.mockReturnValue({ canComment: false });

    const res = await postFeedback();
    expect(res.status).toBe(403);
    expect(mockGetGrantByBookAndSession).toHaveBeenCalledWith(
      expect.anything(), 'book-1', 'user@example.com',
    );
  });
});

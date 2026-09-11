import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryFirst,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
  mockRequireAdminAuth,
  mockStepUpAssured,
} from './fixtures';
import { makeAuthContext } from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({
  parseLocatorRow: vi.fn(),
  assertBookAccess: vi.fn(),
}));

const mockAssertBookAccess = assertBookAccess as Mock;

const CREATOR_AUTH = () => makeAuthContext({ email: 'creator@example.com' });

function seedAssignment(hasRow = true) {
  mockQueryFirst.mockResolvedValueOnce(hasRow ? { id: 'assign-1' } : null);
  if (hasRow) {
    mockQueryFirst.mockResolvedValueOnce({ id: 'user-creator' });
  }
}

const FEEDBACK_ROW = {
  id: 'fb-1', book_id: 'book-1', kind: 'suggestion', category: 'grammar',
  body: 'Consider a comma.', proposed_text: 'Consider, a comma.',
  book_file_id: 'file-1', source_sha256: 'sha256:abc', chapter_ref: 'ch1',
  cfi: 'epubcfi(/6/4)', selected_text: 'Consider a comma.', prefix: 'Hi. ', suffix: ' Bye.',
  submitter_email: 'reader@example.com', status: 'open',
  created_at: 'now', updated_at: 'now',
};

describe('Creator Review Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
  });

  it('lists only assigned books for a creator', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    mockQueryAll.mockResolvedValueOnce([
      { id: 'book-1', slug: 'book-a', title: 'Book A' },
    ]);

    const res = await app.fetch(new Request('http://localhost/api/creator/books', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const payload: { data: { id: string }[] } = await res.json();
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].id).toBe('book-1');
  });

  it('returns an empty list (not a redirect) for unassigned sessions', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    mockQueryAll.mockResolvedValueOnce([]);

    const res = await app.fetch(new Request('http://localhost/api/creator/books', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const payload: { data: unknown[] } = await res.json();
    expect(payload.data).toEqual([]);
  });

  it('rejects unassigned creator access with 403', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment(false);

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/feedback', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(403);
  });

  it('lists assigned-book feedback with provenance for a creator', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment(true);
    mockQueryAll.mockResolvedValueOnce([{ ...FEEDBACK_ROW }]);
    mockQueryFirst.mockResolvedValueOnce({ n: 2 });

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/feedback', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const payload: { data: Record<string, unknown>[] } = await res.json();
    expect(payload.data).toHaveLength(1);
    const item = payload.data[0];
    expect(item.submitterEmail).toBe('reader@example.com');
    expect(item.proposedText).toBe('Consider, a comma.');
    const anchor = item.anchor as Record<string, unknown>;
    expect(anchor.sourceSha256).toBe('sha256:abc');
    expect(anchor.selectedText).toBe('Consider a comma.');
    expect(item.replyCount).toBe(2);
  });

  it('accepts a suggestion (editorial agreement, files untouched)', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment(true);
    mockQueryFirst.mockResolvedValueOnce({ ...FEEDBACK_ROW }); // current row
    mockQueryAll.mockResolvedValueOnce([]); // replies
    mockQueryAll.mockResolvedValueOnce([ // events
      { actor_email: 'creator@example.com', event: 'accepted', created_at: 'now' },
    ]);
    mockQueryFirst.mockResolvedValueOnce({ ...FEEDBACK_ROW, status: 'accepted' }); // re-read

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/feedback/fb-1/disposition', {
      method: 'POST',
      body: JSON.stringify({ disposition: 'accepted' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const payload: { data: { status: string } } = await res.json();
    expect(payload.data.status).toBe('accepted');
    // No file mutation: only status update + event insert run.
    const writes = mockExecute.mock.calls.map((args) => String(args[1]));
    expect(writes.some((sql) => sql.includes('UPDATE editorial_feedback'))).toBe(true);
    expect(writes.some((sql) => sql.includes('UPDATE book_files'))).toBe(false);
  });

  it('rejects accepting a comment as a suggestion (422 illegal transition)', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment(true);
    mockQueryFirst.mockResolvedValueOnce({ ...FEEDBACK_ROW, kind: 'comment' });

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/feedback/fb-1/disposition', {
      method: 'POST',
      body: JSON.stringify({ disposition: 'accepted' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(422);
  });

  it('rejects any disposition on withdrawn feedback (422 terminal)', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment(true);
    mockQueryFirst.mockResolvedValueOnce({ ...FEEDBACK_ROW, status: 'withdrawn' });

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/feedback/fb-1/disposition', {
      method: 'POST',
      body: JSON.stringify({ disposition: 'open' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(422);
  });

  it('reopens a resolved comment', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment(true);
    mockQueryFirst.mockResolvedValueOnce({ ...FEEDBACK_ROW, kind: 'comment', status: 'resolved' });
    mockQueryAll.mockResolvedValueOnce([]);
    mockQueryAll.mockResolvedValueOnce([
      { actor_email: 'creator@example.com', event: 'reopened', created_at: 'now' },
    ]);
    mockQueryFirst.mockResolvedValueOnce({ ...FEEDBACK_ROW, kind: 'comment', status: 'open' });

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/feedback/fb-1/disposition', {
      method: 'POST',
      body: JSON.stringify({ disposition: 'open' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const payload: { data: { status: string } } = await res.json();
    expect(payload.data.status).toBe('open');
  });

  it('records creator replies with creator authorship', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment(true);
    mockQueryFirst.mockResolvedValueOnce({ ...FEEDBACK_ROW });
    mockQueryAll.mockResolvedValueOnce([{
      id: 'r-1', author_email: 'creator@example.com', author_role: 'creator',
      body: 'Good catch.', created_at: 'now',
    }]);
    mockQueryAll.mockResolvedValueOnce([]);
    mockQueryFirst.mockResolvedValueOnce({ ...FEEDBACK_ROW });

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/feedback/fb-1/replies', {
      method: 'POST',
      body: JSON.stringify({ body: 'Good catch.' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(201);
    const insert = mockExecute.mock.calls.find((args) =>
      String(args[1]).includes('INSERT INTO feedback_replies'));
    expect(String(insert?.[1])).toMatch(/'creator'/);
    const payload: { data: { replies: { authorRole: string }[] } } = await res.json();
    expect(payload.data.replies[0].authorRole).toBe('creator');
  });

  it('exports selected items with exact text and provenance', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment(true);
    mockQueryFirst.mockResolvedValueOnce({ ...FEEDBACK_ROW });
    mockQueryAll.mockResolvedValueOnce([]);
    mockQueryAll.mockResolvedValueOnce([]);

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/export', {
      method: 'POST',
      body: JSON.stringify({ ids: ['33333333-3333-4333-8333-333333333333'] }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const payload: { data: { items: Record<string, unknown>[] } } = await res.json();
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0].body).toBe('Consider a comma.');
    expect(payload.data.items[0].proposedText).toBe('Consider, a comma.');
  });

  it('denies export to unassigned sessions (403)', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment(false);

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/export', {
      method: 'POST',
      body: JSON.stringify({ ids: ['33333333-3333-4333-8333-333333333333'] }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(403);
  });
});

describe('Admin Creator Assignment Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
  });

  it('assigns a creator with an existing account (201 + audit)', async () => {
    mockStepUpAssured();
    mockQueryFirst.mockResolvedValueOnce({ id: 'book-1' }); // book
    mockQueryFirst.mockResolvedValueOnce({ id: 'user-9' }); // user
    mockQueryFirst.mockResolvedValueOnce(null); // no existing assignment

    const res = await app.fetch(new Request('http://localhost/api/admin/books/book-1/creators', {
      method: 'POST',
      body: JSON.stringify({ email: 'creator@example.com' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(201);
    const insert = mockExecute.mock.calls.find((args) =>
      String(args[1]).includes('INSERT INTO book_creators'));
    expect(insert?.[2]).toContain('user-9');
  });

  it('returns 404 when assigning an email with no account (never auto-creates)', async () => {
    mockStepUpAssured();
    mockQueryFirst.mockResolvedValueOnce({ id: 'book-1' }); // book
    mockQueryFirst.mockResolvedValueOnce(null); // no user

    const res = await app.fetch(new Request('http://localhost/api/admin/books/book-1/creators', {
      method: 'POST',
      body: JSON.stringify({ email: 'ghost@example.com' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(404);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('revokes via hard delete (200)', async () => {
    mockStepUpAssured();
    mockQueryFirst.mockResolvedValueOnce({ id: 'user-9' }); // user

    const res = await app.fetch(new Request('http://localhost/api/admin/books/book-1/creators', {
      method: 'DELETE',
      body: JSON.stringify({ email: 'creator@example.com' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const del = mockExecute.mock.calls.find((args) =>
      String(args[1]).includes('DELETE FROM book_creators'));
    expect(del?.[2]).toEqual(['book-1', 'user-9']);
  });
});

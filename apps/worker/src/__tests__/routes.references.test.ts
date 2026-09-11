import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  makeEnv,
  makeAuthContext,
  makePassThroughContext,
  mockQueryFirst,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
} from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({
  parseLocatorRow: vi.fn(),
  assertBookAccess: vi.fn(),
}));

const mockAssertBookAccess = assertBookAccess as Mock;

const env = makeEnv();

const REF_ROW = {
  id: 'ref-1',
  book_id: 'book-1',
  kind: 'external_citation',
  title: 'History source',
  content: 'The bridge was built in 1889.',
  attribution: 'creator@example.com',
  source_url: 'https://example.com/source',
  origin: 'external',
  verified: 0,
  revision: 1,
  created_by: 'creator@example.com',
  created_at: 'now',
  updated_at: 'now',
};

const CREATOR_AUTH = () => makeAuthContext({ email: 'creator@example.com' });

function seedAssignment() {
  mockQueryFirst.mockResolvedValueOnce({ id: 'assign-1' });
  mockQueryFirst.mockResolvedValueOnce({ id: 'user-creator' });
}

describe('References & style (Wave 3, COL-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
  });

  it('lists references for an assigned creator', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();
    mockQueryAll.mockResolvedValueOnce([REF_ROW]);

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/references', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const payload: { data: Record<string, unknown>[] } = await res.json();
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].verified).toBe(false);
    expect(payload.data[0].sourceUrl).toBe('https://example.com/source');
  });

  it('rejects reference list for unassigned creator (403)', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    mockQueryFirst.mockResolvedValueOnce(null); // no assignment

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/references', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(403);
  });

  it('creates an external citation born unverified', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();
    mockQueryFirst.mockResolvedValueOnce(REF_ROW); // re-read after insert

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/references', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'external_citation',
        content: 'The bridge was built in 1889.',
        sourceUrl: 'https://example.com/source',
        origin: 'external',
      }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(201);
    const payload: { data: Record<string, unknown> } = await res.json();
    expect(payload.data.verified).toBe(false);
    const insert = mockExecute.mock.calls.find((args) =>
      String(args[1]).includes('INSERT INTO book_references'));
    expect(String(insert?.[1])).toContain('verified');
  });

  it('rejects an external citation without sourceUrl (400)', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/references', {
      method: 'POST',
      body: JSON.stringify({ kind: 'external_citation', content: 'x', origin: 'external' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(400);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('rejects a non-external reference carrying sourceUrl (400)', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/references', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'glossary_term',
        content: 'term meaning',
        origin: 'book',
        sourceUrl: 'https://example.com/x',
      }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(400);
  });

  it('bumps revision on edit so pinned feedback shows drift', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();
    mockQueryFirst.mockResolvedValueOnce({ ...REF_ROW, kind: 'glossary_term', origin: 'book' });

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/references/ref-1', {
      method: 'PATCH',
      body: JSON.stringify({ content: 'Updated meaning.' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const update = mockExecute.mock.calls.find((args) =>
      String(args[1]).includes('revision = revision + 1'));
    expect(update).toBeDefined();
  });

  it('deletes a reference with audit', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();
    mockQueryFirst.mockResolvedValueOnce({ ...REF_ROW });

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/references/ref-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    expect(mockExecute.mock.calls.some((args) =>
      String(args[1]).includes('DELETE FROM book_references'))).toBe(true);
  });

  it('verify requires an evidence note and appends it to content', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();
    mockQueryFirst.mockResolvedValueOnce({ ...REF_ROW });

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/references/ref-1/verify', {
      method: 'POST',
      body: JSON.stringify({ verified: true, evidenceNote: 'County archive record 1889-12' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const update = mockExecute.mock.calls.find((args) =>
      String(args[1]).includes('UPDATE book_references'));
    expect(String(update?.[2])).toContain('[verified');
    expect(String(update?.[2])).toContain('County archive record 1889-12');
  });

  it('rejects verify without evidence note (400)', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/references/ref-1/verify', {
      method: 'POST',
      body: JSON.stringify({ verified: true, evidenceNote: '' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(400);
  });

  it('rejects verify on a non-external reference (422)', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();
    mockQueryFirst.mockResolvedValueOnce({ ...REF_ROW, origin: 'book' });

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/references/ref-1/verify', {
      method: 'POST',
      body: JSON.stringify({ verified: true, evidenceNote: 'note' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(422);
  });

  it('style profile upsert records approval on approved status', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();
    mockQueryFirst.mockResolvedValueOnce(null); // no existing profile

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/style', {
      method: 'PUT',
      body: JSON.stringify({
        language: 'en',
        narrativePerson: 'third-limited',
        status: 'approved',
      }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const payload: { data: Record<string, unknown> } = await res.json();
    expect(payload.data.approvedBy).toBe('creator@example.com');
    expect(payload.data.status).toBe('approved');
  });

  it('style profile draft save records no approver', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();
    mockQueryFirst.mockResolvedValueOnce(null); // no existing profile

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/style', {
      method: 'PUT',
      body: JSON.stringify({ status: 'draft' }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const payload: { data: Record<string, unknown> } = await res.json();
    expect(payload.data.approvedBy).toBeNull();
    expect(payload.data.revision).toBe(1);
  });
});

describe('Anchor state computation (Wave 3)', () => {
  beforeEach(() => {
    // Wave 2 tests queued mockResolvedValueOnce values that outlive clearAllMocks;
    // a stale queue made ownFeedbackOr404 see rows from prior tests. Hard-reset here.
    mockQueryFirst.mockReset();
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
  });

  function feedbackRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'fb-1', book_id: 'book-1', kind: 'comment', category: 'general',
      body: 'x', proposed_text: null, book_file_id: 'file-1',
      source_sha256: 'sha256:aaa', chapter_ref: null, cfi: null,
      selected_text: 'x', prefix: null, suffix: null,
      submitter_email: 'user@example.com', status: 'open',
      mutation_id: 'm1', reference_revisions: null,
      created_at: 'now', updated_at: 'now',
      ...overrides,
    };
  }

  it('returns resolved when stored sha matches current file sha', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'book-1' }));
    const row = feedbackRow({"reference_revisions":null});
    mockQueryFirst.mockImplementation((_env: unknown, sql: unknown) => {
      const q = String(sql);
        if (q.includes('editorial_feedback')) return Promise.resolve(row);
      if (q.includes('book_files')) return Promise.resolve({ sha256: 'sha256:aaa' });
      if (q.includes('COUNT(*)')) return Promise.resolve({ n: 0 });
      return Promise.resolve(undefined as never);
    });

    const res = await app.fetch(new Request('http://localhost/api/books/book-1/feedback/fb-1', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    const payload: { data: Record<string, unknown> } = await res.json();
    expect((payload.data as { anchorState: string } | null)?.anchorState).toBe('resolved');
  });
  it('returns source_changed when the file sha no longer matches', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'book-1' }));
    const row = feedbackRow({"reference_revisions":null});
    mockQueryFirst.mockImplementation((_env: unknown, sql: unknown) => {
      const q = String(sql);
      if (q.includes('editorial_feedback')) return Promise.resolve(row);
      if (q.includes('book_files')) return Promise.resolve({ sha256: 'sha256:NEW' });
      if (q.includes('COUNT(*)')) return Promise.resolve({ n: 0 });
      return Promise.resolve(undefined as never);
    });

    const res = await app.fetch(new Request('http://localhost/api/books/book-1/feedback/fb-1', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    const payload: { data: Record<string, unknown> } = await res.json();
    expect((payload.data as { anchorState: string } | null)?.anchorState).toBe('source_changed');
  });
  it('returns source_changed when the file row is gone (re-upload replaced it)', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'book-1' }));
    const row = feedbackRow({"reference_revisions":null});
    mockQueryFirst.mockImplementation((_env: unknown, sql: unknown) => {
      const q = String(sql);
      if (q.includes('editorial_feedback')) return Promise.resolve(row);
      if (q.includes('book_files')) return Promise.resolve(null);
      if (q.includes('COUNT(*)')) return Promise.resolve({ n: 0 });
      return Promise.resolve(undefined as never);
    });

    const res = await app.fetch(new Request('http://localhost/api/books/book-1/feedback/fb-1', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    const payload: { data: Record<string, unknown> } = await res.json();
    expect((payload.data as { anchorState: string } | null)?.anchorState).toBe('source_changed');
  });
  it('returns unresolved for book-level feedback with no anchor', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'book-1' }));
    const row = feedbackRow({"reference_revisions":null,"book_file_id":null,"source_sha256":null});
    mockQueryFirst.mockImplementation((_env: unknown, sql: unknown) => {
      const q = String(sql);
      if (q.includes('editorial_feedback')) return Promise.resolve(row);
      if (q.includes('book_files')) return Promise.resolve({ sha256: 'undefined' });
      if (q.includes('COUNT(*)')) return Promise.resolve({ n: 0 });
      return Promise.resolve(undefined as never);
    });

    const res = await app.fetch(new Request('http://localhost/api/books/book-1/feedback/fb-1', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    const payload: { data: Record<string, unknown> } = await res.json();
    expect((payload.data as { anchorState: string } | null)?.anchorState).toBe('unresolved');
  });
  it('echoes pinned reference revisions on the DTO', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'book-1' }));
    const row = feedbackRow({"reference_revisions":"{\"ref-1\":2}"});
    mockQueryFirst.mockImplementation((_env: unknown, sql: unknown) => {
      const q = String(sql);
      if (q.includes('editorial_feedback')) return Promise.resolve(row);
      if (q.includes('book_files')) return Promise.resolve({ sha256: 'sha256:aaa' });
      if (q.includes('COUNT(*)')) return Promise.resolve({ n: 0 });
      return Promise.resolve(undefined as never);
    });

    const res = await app.fetch(new Request('http://localhost/api/books/book-1/feedback/fb-1', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());
    const payload: { data: Record<string, unknown> } = await res.json();
    expect((payload.data as { anchorState: string } | null)?.anchorState).toBe('resolved');
    expect((payload.data as { referenceRevisions: Record<string, number> } | null)?.referenceRevisions).toEqual({ 'ref-1': 2 });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEnv, makeAuthContext, makePassThroughContext, mockQueryAll, mockRequireAuth, parseBody } from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({ parseLocatorRow: vi.fn(), assertBookAccess: vi.fn() }));
const mockAssertBookAccess = assertBookAccess as ReturnType<typeof vi.fn>;

describe('Export Routes', () => {
  const env = makeEnv();

  /** Queue the three concurrent export queries (highlights, comments, bookmarks) as resolved once. */
  function mockExportRows(highlights: unknown[] = [], comments: unknown[] = [], bookmarks: unknown[] = []) {
    mockQueryAll.mockResolvedValueOnce(highlights);
    mockQueryAll.mockResolvedValueOnce(comments);
    mockQueryAll.mockResolvedValueOnce(bookmarks);
  }

  /** Stub the book-title lookup the export route performs after the row queries. */
  function mockBookTitle(title: string) {
    const mockFirst = vi.fn().mockResolvedValue({ title });
    (env.DB as unknown as { first: ReturnType<typeof vi.fn> }).first = mockFirst;
  }

  /** Build a highlight row fixture with per-test overrides. */
  function makeHighlightData(overrides: Record<string, unknown> = {}) {
    return {
      id: 'h1',
      selected_text: 'Default',
      color: 'yellow',
      note: null,
      chapter_ref: 'ch1',
      cfi_range: null,
      created_at: '2026-07-18',
      ...overrides,
    };
  }

  beforeEach(() => { vi.clearAllMocks(); mockAssertBookAccess.mockResolvedValue(null); });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await app.fetch(new Request('http://localhost/api/books/b1/export'), env, makePassThroughContext());
    expect(res.status).toBe(401);
  });

  it('returns markdown export with highlights', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExportRows([makeHighlightData({ selected_text: 'Important', note: 'My note' })]);
    mockBookTitle('Test Book');
    const res = await app.fetch(new Request('http://localhost/api/books/b1/export?format=markdown', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.format).toBe('markdown');
    expect(body.data.content).toContain('Important');
  });

  it('escapes special characters including single quotes in HTML export', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExportRows([makeHighlightData({
      selected_text: `<script>alert('XSS')</script>`,
      note: `User's "special" & <dangerous> note`,
      chapter_ref: `Ch 1 & '2'`,
    })]);
    mockBookTitle(`O'Reilly <Book> & "More"`);

    const res = await app.fetch(
      new Request('http://localhost/api/books/b1/export?format=html', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    const content = body.data.content as string;

    expect(content).not.toContain('<script>');
    expect(content).toContain('&lt;script&gt;');
    expect(content).toContain('O&#39;Reilly');
    expect(content).toContain('User&#39;s');
    expect(content).toContain('&quot;special&quot;');
  });

  it('escapes markdown formatting characters in Markdown export', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExportRows([makeHighlightData({
      selected_text: '*Bold & [Link](http://evil.com)* # Header',
      note: 'Note with `code` and > quote',
      chapter_ref: 'Ch #1 *test*',
    })]);
    mockBookTitle('# Title with [link]');

    const res = await app.fetch(
      new Request('http://localhost/api/books/b1/export?format=markdown', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    const content = body.data.content as string;

    expect(content).toContain('\\# Title');
    expect(content).toContain('\\[link\\]');
    expect(content).toContain('\\*Bold');
  });

  it('returns html export with proper structure', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockExportRows();
    mockBookTitle('Test');
    const res = await app.fetch(new Request('http://localhost/api/books/b1/export?format=html', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.data.format).toBe('html');
    expect(typeof body.data.content).toBe('string');
    expect((body.data.content as string).length).toBeGreaterThan(100);
  });

  it('threads comment replies under their top-level parent in the export', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    // Deliberately interleaved source order: a later top-level parent, then an
    // earlier one, with replies for each. threadComments must preserve
    // top-level source order and keep each parent's replies immediately
    // beneath it.
    mockExportRows([], [
      { id: 'c2', body: 'Parent 2', selected_text: null, chapter_ref: null, cfi_range: null, status: 'active', parent_comment_id: null, created_at: '2026-07-18' },
      { id: 'c1', body: 'Parent 1', selected_text: null, chapter_ref: null, cfi_range: null, status: 'active', parent_comment_id: null, created_at: '2026-07-18' },
      { id: 'r1', body: 'Reply to 1', selected_text: null, chapter_ref: null, cfi_range: null, status: 'active', parent_comment_id: 'c1', created_at: '2026-07-18' },
      { id: 'r2', body: 'Reply to 2', selected_text: null, chapter_ref: null, cfi_range: null, status: 'active', parent_comment_id: 'c2', created_at: '2026-07-18' },
      { id: 'r22', body: 'Second reply to 2', selected_text: null, chapter_ref: null, cfi_range: null, status: 'active', parent_comment_id: 'c2', created_at: '2026-07-18' },
    ]);
    mockBookTitle('Threads');

    const res = await app.fetch(
      new Request('http://localhost/api/books/b1/export?format=markdown', {
        headers: { Authorization: 'Bearer valid' },
      }),
      env,
      makePassThroughContext(),
    );
    expect(res.status).toBe(200);
    const content = (await parseBody(res)).data.content as string;

    // Top-level parents render in source order (c2 before c1).
    expect(content.indexOf('Parent 2')).toBeLessThan(content.indexOf('Parent 1'));
    // Each parent's replies render immediately after it, before the next parent.
    expect(content.indexOf('Reply to 2')).toBeGreaterThan(content.indexOf('Parent 2'));
    expect(content.indexOf('Second reply to 2')).toBeGreaterThan(content.indexOf('Reply to 2'));
    expect(content.indexOf('Reply to 2')).toBeLessThan(content.indexOf('Parent 1'));
    expect(content.indexOf('Reply to 1')).toBeGreaterThan(content.indexOf('Parent 1'));
  });

  it('runs the three export queries concurrently', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockBookTitle('Test Book');

    // Deferred promises let us observe that all three queries are started
    // before any result is consumed — the observable signal of Promise.all.
    const resolvers: Array<(v: unknown[]) => void> = [];
    mockQueryAll.mockImplementation(() => new Promise<unknown[]>((resolve) => {
      resolvers.push(resolve);
    }));

    const reqPromise = app.fetch(new Request('http://localhost/api/books/b1/export?format=markdown', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());

    // All three queryAll calls must be issued before any response is produced.
    await vi.waitFor(() => expect(mockQueryAll).toHaveBeenCalledTimes(3));

    resolvers[0]([makeHighlightData({ selected_text: 'Concurrent' })]);
    resolvers[1]([]);
    resolvers[2]([]);

    const res = await reqPromise;
    expect(res.status).toBe(200);
    const body = await parseBody(res);
    const content = body.data.content as string;
    expect(content).toContain('Concurrent');
  });

  it('returns 400 for invalid format', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const res = await app.fetch(new Request('http://localhost/api/books/b1/export?format=invalid', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(400);
  });
});

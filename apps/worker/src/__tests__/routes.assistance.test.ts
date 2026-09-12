import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  makeEnv,
  makeAuthContext,
  makePassThroughContext,
  mockQueryFirst,
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

/** Creator assignment gate: assignment row, then the user lookup. */
function seedAssignment() {
  mockQueryFirst.mockResolvedValueOnce({ id: 'assign-1' });
  mockQueryFirst.mockResolvedValueOnce({ id: 'user-creator' });
}

const CREATOR_AUTH = () => makeAuthContext({ email: 'creator@example.com' });

describe('Assistance consent (Wave 4, AI-02)', () => {
  beforeEach(() => {
    // Queued once-mocks outlive clearAllMocks; hard-reset so a stale row from
    // another suite can never satisfy an assignment gate here.
    mockQueryFirst.mockReset();
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
  });

  it('reports consent OFF and cloud unqualified by default', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();
    mockQueryFirst.mockResolvedValueOnce({ cloud_assistance_allowed: 0 });

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/assistance-consent', {
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());

    expect(res.status).toBe(200);
    const payload: { data: { allowed: boolean; cloudQualified: boolean } } = await res.json();
    expect(payload.data.allowed).toBe(false);
    expect(payload.data.cloudQualified).toBe(false);
  });

  it('records consent for the assigned creator and still reports cloud unqualified', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/assistance-consent', {
      method: 'PUT',
      body: JSON.stringify({ allowed: true }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());

    expect(res.status).toBe(200);
    const payload: { data: { allowed: boolean; cloudQualified: boolean } } = await res.json();
    expect(payload.data.allowed).toBe(true);
    // Consent can never imply capability.
    expect(payload.data.cloudQualified).toBe(false);
    const update = mockExecute.mock.calls.find((args) =>
      String(args[1]).includes('cloud_assistance_allowed = ?'));
    expect(update?.[2]).toEqual([1, 'book-1', 'user-creator']);
  });

  it('denies consent management to unassigned accounts (403)', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    mockQueryFirst.mockResolvedValueOnce(null); // no assignment

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/assistance-consent', {
      method: 'PUT',
      body: JSON.stringify({ allowed: true }),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());

    expect(res.status).toBe(403);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('refuses dispatch with 501 even when consent is granted, without reading book text', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    seedAssignment();

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/assistance/dispatch', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());

    expect(res.status).toBe(501);
    const payload: { ok: boolean; error: { code: string } } = await res.json();
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('ASSISTANCE_NOT_CONFIGURED');

    // The refusal must not have loaded manuscript content: any query touching
    // chapter text or the entity tables would show up here.
    const statements = mockQueryFirst.mock.calls.map((args) => String(args[1]));
    expect(statements.some((sql) => sql.includes('editorial_feedback'))).toBe(false);
    expect(statements.some((sql) => sql.includes('book_files'))).toBe(false);
  });

  it('refuses dispatch to unassigned accounts before doing anything else (403)', async () => {
    mockRequireAuth.mockResolvedValue(CREATOR_AUTH());
    mockQueryFirst.mockResolvedValueOnce(null);

    const res = await app.fetch(new Request('http://localhost/api/creator/books/book-1/assistance/dispatch', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid' },
    }), env, makePassThroughContext());

    expect(res.status).toBe(403);
  });
});

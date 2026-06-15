import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEnv, mockQueryFirst, mockLogAudit, makeAuthContext } from './fixtures';
import { parseLocatorRow, assertBookAccess } from '../lib/tenant-isolation';

describe('Tenant Isolation', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseLocatorRow', () => {
    it('returns parsed object for valid locator', async () => {
      const locatorJson = JSON.stringify({ cfi: 'epubcfi(/6/4)', selectedText: 'test', chapterRef: 'Ch1' });
      const result = await parseLocatorRow(env, locatorJson, { entityType: 'bookmark', entityId: 'b1', bookId: 'book-1' });
      expect(result).toEqual({ cfi: 'epubcfi(/6/4)', selectedText: 'test', chapterRef: 'Ch1' });
    });

    it('returns null for null locator_json', async () => {
      const result = await parseLocatorRow(env, null, { entityType: 'bookmark', entityId: 'b1', bookId: 'book-1' });
      expect(result).toBeNull();
      expect(mockLogAudit).not.toHaveBeenCalled();
    });

    it('returns null and logs audit for invalid JSON', async () => {
      const result = await parseLocatorRow(env, 'not-json', { entityType: 'bookmark', entityId: 'b1', bookId: 'book-1' });
      expect(result).toBeNull();
      expect(mockLogAudit).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          action: 'corrupt_locator',
          payload: expect.objectContaining({ errors: ['Invalid JSON'] }),
        }),
        undefined,
      );
    });

    it('returns null and logs audit for schema failure', async () => {
      const locatorJson = JSON.stringify({ cfi: 'epubcfi(/6/4)' }); // missing selectedText and chapterRef
      const result = await parseLocatorRow(env, locatorJson, { entityType: 'bookmark', entityId: 'b1', bookId: 'book-1' });
      expect(result).toBeNull();
      expect(mockLogAudit).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          action: 'corrupt_locator',
          payload: expect.objectContaining({ errors: expect.arrayContaining([expect.any(String)]) }),
        }),
        undefined,
      );
    });

    it('returns null and logs audit for extra fields with strict schema', async () => {
      const locatorJson = JSON.stringify({ cfi: 'epubcfi(/6/4)', selectedText: 'test', chapterRef: 'Ch1', extra: 'field' });
      const result = await parseLocatorRow(env, locatorJson, { entityType: 'bookmark', entityId: 'b1', bookId: 'book-1' });
      expect(result).toBeNull();
      expect(mockLogAudit).toHaveBeenCalled();
    });
  });

  describe('assertBookAccess', () => {
    it('returns null when auth.bookId matches urlBookId', async () => {
      const auth = makeAuthContext({ bookId: 'book-1' });
      const result = await assertBookAccess(env, auth, 'book-1');
      expect(result).toBeNull();
      expect(mockQueryFirst).not.toHaveBeenCalled();
    });

    it('returns null when auth.bookId differs but grant exists', async () => {
      const auth = makeAuthContext({ bookId: 'book-1' });
      mockQueryFirst.mockResolvedValue({ id: 'grant-2', book_id: 'book-2', email: auth.email, allowed: 1 });
      const result = await assertBookAccess(env, auth, 'book-2');
      expect(result).toBeNull();
    });

    it('returns 403 when auth.bookId differs and no grant', async () => {
      const auth = makeAuthContext({ bookId: 'book-1' });
      mockQueryFirst.mockResolvedValue(null);
      const result = await assertBookAccess(env, auth, 'book-2');
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result?.ok).toBe(false);
      const response = result?.response;
      expect(response?.status).toBe(403);
      const body = await response?.json() as { error: { code: string } };
      expect(body.error.code).toBe('BOOK_SESSION_MISMATCH');
    });

    it('returns 403 when auth.bookId differs and grant is revoked', async () => {
      const auth = makeAuthContext({ bookId: 'book-1' });
      mockQueryFirst.mockResolvedValue(null); // revoked grant returns null due to WHERE clause
      const result = await assertBookAccess(env, auth, 'book-2');
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result?.ok).toBe(false);
    });

    it('logs audit on mismatch', async () => {
      const auth = makeAuthContext({ bookId: 'book-1', sessionId: 'session-1' });
      mockQueryFirst.mockResolvedValue(null);
      await assertBookAccess(env, auth, 'book-2');
      expect(mockLogAudit).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          action: 'book_session_mismatch',
          payload: expect.objectContaining({ sessionBookId: 'book-1', requestedBookId: 'book-2' }),
        }),
        undefined,
      );
    });
  });
});

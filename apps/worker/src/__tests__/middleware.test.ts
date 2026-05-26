import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makeRequest,
  makeSessionRow,
  mockQueryFirst,
  mockValidateSessionMod,
} from './fixtures';

import { requireAuth } from '../auth/middleware';

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no Authorization header', async () => {
    const req = makeRequest();
    const result = await requireAuth(makeEnv(), req);
    expect(result).toBeNull();
  });

  it('returns null for invalid session', async () => {
    const req = makeRequest({ Authorization: 'Bearer invalid' });
    mockValidateSessionMod.mockResolvedValue({ valid: false });
    const result = await requireAuth(makeEnv(), req);
    expect(result).toBeNull();
  });

  it('returns null for expired session', async () => {
    const req = makeRequest({ Authorization: 'Bearer expired-session' });
    mockValidateSessionMod.mockResolvedValue({ valid: false });
    const result = await requireAuth(makeEnv(), req);
    expect(result).toBeNull();
  });

  it('returns null for expired grant', async () => {
    const req = makeRequest({ Authorization: 'Bearer valid' });
    mockValidateSessionMod.mockResolvedValue({
      valid: true,
      session: makeSessionRow() as any,
      bookId: 'book-1',
    });

    // Mock grant row with expired date
    mockQueryFirst.mockResolvedValue({
      id: 'grant-1',
      book_id: 'book-1',
      email: 'user@example.com',
      mode: 'private',
      allowed: 1,
      comments_allowed: 0,
      offline_allowed: 0,
      expires_at: new Date(Date.now() - 3600000).toISOString()
    });

    const result = await requireAuth(makeEnv(), req);
    expect(result).toBeNull();
  });

  it('returns context for valid session and active grant', async () => {
    const req = makeRequest({ Authorization: 'Bearer valid' });
    mockValidateSessionMod.mockResolvedValue({
      valid: true,
      session: makeSessionRow() as any,
      bookId: 'book-1',
    });

    mockQueryFirst.mockResolvedValue({
      id: 'grant-1',
      book_id: 'book-1',
      email: 'user@example.com',
      mode: 'private',
      allowed: 1,
      comments_allowed: 0,
      offline_allowed: 0,
      expires_at: new Date(Date.now() + 3600000).toISOString()
    });

    const result = await requireAuth(makeEnv(), req);
    expect(result).not.toBeNull();
    expect(result?.email).toBe('user@example.com');
  });

  it('returns context for valid session and grant with no expiration', async () => {
    const req = makeRequest({ Authorization: 'Bearer valid' });
    mockValidateSessionMod.mockResolvedValue({
      valid: true,
      session: makeSessionRow() as any,
      bookId: 'book-1',
    });

    // Test with undefined as well as null for expires_at
    mockQueryFirst.mockResolvedValue({
      id: 'grant-1',
      book_id: 'book-1',
      email: 'user@example.com',
      mode: 'private',
      allowed: 1,
      comments_allowed: 0,
      offline_allowed: 0,
      // Missing expires_at should be treated as null
    });

    const result = await requireAuth(makeEnv(), req);
    expect(result).not.toBeNull();
    expect(result?.email).toBe('user@example.com');
  });
});

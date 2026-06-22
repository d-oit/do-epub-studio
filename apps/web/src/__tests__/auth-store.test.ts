import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, parseExpiresAt } from '../stores/auth';

describe('parseExpiresAt', () => {
  it('returns null for null', () => {
    expect(parseExpiresAt(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseExpiresAt(undefined)).toBeNull();
  });

  it('returns number as-is', () => {
    expect(parseExpiresAt(1234567890)).toBe(1234567890);
  });

  it('parses date string', () => {
    const result = parseExpiresAt('2025-01-01T00:00:00.000Z');
    expect(result).toBeTypeOf('number');
  });

  it('returns null for invalid date', () => {
    expect(parseExpiresAt('invalid')).toBeNull();
  });
});

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      sessionToken: null,
      sessionExpiresAt: null,
      bookId: null,
      bookSlug: null,
      bookTitle: null,
      email: null,
      capabilities: null,
      isAuthenticated: false,
      isAdmin: false,
    });
  });

  it('has initial state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isAdmin).toBe(false);
    expect(state.sessionToken).toBeNull();
  });

  it('sets auth', () => {
    useAuthStore.getState().setAuth({
      sessionToken: 'token-123',
      bookId: 'book-1',
      bookSlug: 'my-book',
      bookTitle: 'My Book',
      email: 'test@example.com',
      capabilities: null,
    });
    const state = useAuthStore.getState();
    expect(state.sessionToken).toBe('token-123');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isAdmin).toBe(false);
  });

  it('sets admin auth', () => {
    useAuthStore.getState().setAdminAuth({
      sessionToken: 'admin-token',
      email: 'admin@example.com',
    });
    const state = useAuthStore.getState();
    expect(state.sessionToken).toBe('admin-token');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isAdmin).toBe(true);
  });

  it('refreshes session', () => {
    useAuthStore.getState().setAuth({
      sessionToken: 'old-token',
      bookId: 'book-1',
      bookSlug: 'my-book',
      bookTitle: 'My Book',
      email: 'test@example.com',
      capabilities: null,
    });
    useAuthStore.getState().refreshSession({
      sessionToken: 'new-token',
    });
    const state = useAuthStore.getState();
    expect(state.sessionToken).toBe('new-token');
  });

  it('logs out', () => {
    useAuthStore.getState().setAuth({
      sessionToken: 'token-123',
      bookId: 'book-1',
      bookSlug: 'my-book',
      bookTitle: 'My Book',
      email: 'test@example.com',
      capabilities: null,
    });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.sessionToken).toBeNull();
  });

  it('logout("expired") sets sessionExpired for redirect routing', () => {
    useAuthStore.getState().setAdminAuth({
      sessionToken: 'admin-token',
      email: 'admin@test.com',
    });
    expect(useAuthStore.getState().sessionExpired).toBe(false);

    useAuthStore.getState().logout('expired');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isAdmin).toBe(false);
    expect(state.sessionExpired).toBe(true);
  });

  it('manual logout clears sessionExpired', () => {
    useAuthStore.getState().setAdminAuth({
      sessionToken: 'admin-token',
      email: 'admin@test.com',
    });
    useAuthStore.getState().logout('expired');
    expect(useAuthStore.getState().sessionExpired).toBe(true);

    useAuthStore.getState().setAdminAuth({
      sessionToken: 'admin-token-2',
      email: 'admin@test.com',
    });
    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });
});

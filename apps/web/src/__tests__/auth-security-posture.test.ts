/**
 * Regression test for ADR-092 compensating controls.
 *
 * These assertions are load-bearing: if any of these guards are removed
 * from the codebase, this test fails first — alerting the reviewer to
 * update the ADR before merging.
 *
 * See: plans/archive/092-adr-token-storage-and-feature-gap-policy.md
 *      plans/200-adr-session-lockout-compensating-control.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, parseExpiresAt } from '../stores/auth';

describe('ADR-092 compensating-controls regression (auth partialize)', () => {
  beforeEach(() => {
    // Reset store to clean state before each test
    useAuthStore.getState().logout('manual');
  });

  it('partialize includes sessionToken — token IS persisted (accepted localStorage posture)', () => {
    // If sessionToken is removed from partialize, update this test AND ADR-092 together.
    useAuthStore.getState().setAuth({
      sessionToken: 'a'.repeat(64),
      sessionExpiresAt: Date.now() + 86_400_000,
      bookId: 'book-1',
      bookSlug: 'test-slug',
      bookTitle: 'Test Book',
      email: 'test@example.com',
      capabilities: {
        canRead: true,
        canComment: false,
        canHighlight: false,
        canBookmark: false,
        canDownloadOffline: false,
        canExportNotes: false,
        canManageAccess: false,
      },
    });

    const stored = localStorage.getItem('do-epub-auth');
    expect(stored).not.toBeNull();
    if (!stored) return;
    const parsed = JSON.parse(stored) as { state?: Record<string, unknown> };
    // Zustand persist wraps the state in { state: {...}, version: N }
    const state = parsed.state ?? parsed;
    expect(state).toHaveProperty('sessionToken');
    expect((state as Record<string, unknown>).sessionToken).toBe('a'.repeat(64));
  });

  it('partialize does NOT include sessionExpired — it is a transient signal only', () => {
    // sessionExpired is intentionally NOT persisted: it is a transient API-client
    // signal that resets on page reload via setAuth / setAdminAuth / logout('manual').
    // See the comment in apps/web/src/stores/auth.ts partialize function.
    useAuthStore.getState().logout('expired');
    expect(useAuthStore.getState().sessionExpired).toBe(true);

    const stored = localStorage.getItem('do-epub-auth');
    expect(stored).not.toBeNull();
    if (!stored) return;
    const parsed = JSON.parse(stored) as { state?: Record<string, unknown> };
    const state = parsed.state ?? parsed;
    // sessionExpired must not be persisted to localStorage
    expect(state).not.toHaveProperty('sessionExpired');
  });

  it('parseExpiresAt returns null for null input without throwing', () => {
    expect(parseExpiresAt(null)).toBeNull();
  });

  it('parseExpiresAt returns null for undefined input without throwing', () => {
    expect(parseExpiresAt(undefined)).toBeNull();
  });

  it('parseExpiresAt returns a number unchanged', () => {
    const ts = Date.now();
    expect(parseExpiresAt(ts)).toBe(ts);
  });

  it('parseExpiresAt parses a valid ISO date string to milliseconds', () => {
    const iso = '2026-12-31T00:00:00.000Z';
    const expected = new Date(iso).getTime();
    expect(parseExpiresAt(iso)).toBe(expected);
  });

  it('parseExpiresAt returns null for an invalid date string without throwing', () => {
    expect(parseExpiresAt('not-a-date')).toBeNull();
  });
});

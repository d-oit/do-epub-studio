import { describe, expect, it, beforeEach } from 'vitest';
import { useAuthStore } from '../stores/auth';
import { useLocaleStore } from '../stores/locale';
import { usePreferencesStore } from '../stores/preferences';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.sessionToken).toBeNull();
    expect(state.isAdmin).toBe(false);
  });

  it('sets auth with reader capabilities', () => {
    useAuthStore.getState().setAuth({
      sessionToken: 'tok_abc123',
      bookId: 'book-uuid-1',
      bookSlug: 'my-book',
      bookTitle: 'My Book',
      email: 'reader@example.com',
      capabilities: {
        canRead: true,
        canComment: true,
        canHighlight: true,
        canBookmark: true,
        canDownloadOffline: false,
        canExportNotes: true,
        canManageAccess: false,
      },
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isAdmin).toBe(false);
    expect(state.sessionToken).toBe('tok_abc123');
    expect(state.bookSlug).toBe('my-book');
    expect(state.capabilities?.canRead).toBe(true);
    expect(state.capabilities?.canManageAccess).toBe(false);
  });

  it('sets admin auth', () => {
    useAuthStore.getState().setAdminAuth({
      sessionToken: 'admin_tok_xyz',
      email: 'admin@example.com',
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isAdmin).toBe(true);
    expect(state.sessionToken).toBe('admin_tok_xyz');
    expect(state.bookSlug).toBeNull();
  });

  it('clears all state on logout', () => {
    useAuthStore.getState().setAuth({
      sessionToken: 'tok',
      bookId: 'id',
      bookSlug: 'slug',
      bookTitle: 'Title',
      email: 'user@test.com',
      capabilities: {
        canRead: true,
        canComment: true,
        canHighlight: true,
        canBookmark: true,
        canDownloadOffline: true,
        canExportNotes: true,
        canManageAccess: true,
      },
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.sessionToken).toBeNull();
    expect(state.bookId).toBeNull();
    expect(state.capabilities).toBeNull();
  });
});

describe('useLocaleStore', () => {
  beforeEach(() => {
    useLocaleStore.getState().setLocale('en');
  });

  it('defaults to en locale', () => {
    const state = useLocaleStore.getState();
    expect(state.locale).toBe('en');
  });

  it('changes locale', () => {
    useLocaleStore.getState().setLocale('de');
    expect(useLocaleStore.getState().locale).toBe('de');
  });

  it('accepts all supported locales', () => {
    const store = useLocaleStore.getState();
    store.setLocale('fr');
    expect(useLocaleStore.getState().locale).toBe('fr');
    store.setLocale('en');
    expect(useLocaleStore.getState().locale).toBe('en');
  });
});

describe('usePreferencesStore', () => {
  beforeEach(() => {
    const store = usePreferencesStore.getState();
    store.setTheme('system');
    store.setFontFamily('serif');
    store.setFontSize('medium');
    store.setLineHeight(2);
    store.setPageWidth('normal');
  });

  it('has default reader preferences', () => {
    const state = usePreferencesStore.getState();
    expect(state.reader.theme).toBe('system');
    expect(state.reader.fontFamily).toBe('serif');
    expect(state.reader.fontSize).toBe('medium');
    expect(state.reader.lineHeight).toBe(2);
    expect(state.reader.pageWidth).toBe('normal');
  });

  it('updates theme', () => {
    usePreferencesStore.getState().setTheme('dark');
    expect(usePreferencesStore.getState().reader.theme).toBe('dark');
  });

  it('updates font size', () => {
    usePreferencesStore.getState().setFontSize('xlarge');
    expect(usePreferencesStore.getState().reader.fontSize).toBe('xlarge');
  });

  it('updates line height', () => {
    usePreferencesStore.getState().setLineHeight(3);
    expect(usePreferencesStore.getState().reader.lineHeight).toBe(3);
  });

  it('preserves other preferences when updating one', () => {
    usePreferencesStore.getState().setTheme('sepia');
    usePreferencesStore.getState().setFontFamily('monospace');

    const state = usePreferencesStore.getState();
    expect(state.reader.theme).toBe('sepia');
    expect(state.reader.fontFamily).toBe('monospace');
    expect(state.reader.fontSize).toBe('medium');
    expect(state.reader.lineHeight).toBe(2);
  });
});

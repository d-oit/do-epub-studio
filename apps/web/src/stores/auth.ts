import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  sessionToken: string | null;
  sessionExpiresAt: number | null;
  bookId: string | null;
  bookSlug: string | null;
  bookTitle: string | null;
  email: string | null;
  capabilities: {
    canRead: boolean;
    canComment: boolean;
    canHighlight: boolean;
    canBookmark: boolean;
    canDownloadOffline: boolean;
    canExportNotes: boolean;
    canManageAccess: boolean;
  } | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  sessionExpired: boolean;
  setAuth: (data: {
    sessionToken: string;
    sessionExpiresAt?: number | null;
    bookId: string;
    bookSlug: string;
    bookTitle: string;
    email: string;
    capabilities: AuthState['capabilities'];
  }) => void;
  setAdminAuth: (data: { sessionToken: string; email: string; sessionExpiresAt?: number | null }) => void;
  refreshSession: (data: { sessionToken: string; sessionExpiresAt?: number | null }) => void;
  logout: (reason?: 'manual' | 'expired') => void;
}

function parseExpiresAt(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return input;
  const ms = new Date(input).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      sessionToken: null,
      sessionExpiresAt: null,
      bookId: null,
      bookSlug: null,
      bookTitle: null,
      email: null,
      capabilities: null,
      isAuthenticated: false,
      isAdmin: false,
      sessionExpired: false,
      setAuth: (data) =>
        set({
          sessionToken: data.sessionToken,
          sessionExpiresAt: data.sessionExpiresAt ?? null,
          bookId: data.bookId,
          bookSlug: data.bookSlug,
          bookTitle: data.bookTitle,
          email: data.email,
          capabilities: data.capabilities,
          isAuthenticated: true,
          isAdmin: false,
          sessionExpired: false,
        }),
      setAdminAuth: (data) =>
        set({
          sessionToken: data.sessionToken,
          sessionExpiresAt: data.sessionExpiresAt ?? null,
          email: data.email,
          isAuthenticated: true,
          isAdmin: true,
          sessionExpired: false,
        }),
      refreshSession: (data) =>
        set({
          sessionToken: data.sessionToken,
          sessionExpiresAt: data.sessionExpiresAt ?? null,
        }),
      logout: (reason = 'manual') =>
        set({
          sessionToken: null,
          sessionExpiresAt: null,
          bookId: null,
          bookSlug: null,
          bookTitle: null,
          email: null,
          capabilities: null,
          isAuthenticated: false,
          isAdmin: false,
          sessionExpired: reason === 'expired',
        }),
    }),
    {
      name: 'do-epub-auth',
      partialize: (state) => ({
        sessionToken: state.sessionToken,
        sessionExpiresAt: state.sessionExpiresAt,
        bookId: state.bookId,
        bookSlug: state.bookSlug,
        bookTitle: state.bookTitle,
        email: state.email,
        capabilities: state.capabilities,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
        // sessionExpired is intentionally NOT persisted — it is a
        // transient signal that the API client flips when it sees a
        // 401. On page reload the user re-authenticates and the flag
        // resets via setAuth / setAdminAuth / logout('manual').
      }),
    }
  )
);

export { parseExpiresAt };

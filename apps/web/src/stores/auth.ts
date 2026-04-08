import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  sessionToken: string | null;
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
  setAuth: (data: {
    sessionToken: string;
    bookId: string;
    bookSlug: string;
    bookTitle: string;
    email: string;
    capabilities: AuthState['capabilities'];
  }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      sessionToken: null,
      bookId: null,
      bookSlug: null,
      bookTitle: null,
      email: null,
      capabilities: null,
      isAuthenticated: false,
      setAuth: (data) =>
        set({
          sessionToken: data.sessionToken,
          bookId: data.bookId,
          bookSlug: data.bookSlug,
          bookTitle: data.bookTitle,
          email: data.email,
          capabilities: data.capabilities,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          sessionToken: null,
          bookId: null,
          bookSlug: null,
          bookTitle: null,
          email: null,
          capabilities: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'do-epub-auth',
      partialize: (state) => ({
        sessionToken: state.sessionToken,
        bookId: state.bookId,
        bookSlug: state.bookSlug,
        bookTitle: state.bookTitle,
        email: state.email,
        capabilities: state.capabilities,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

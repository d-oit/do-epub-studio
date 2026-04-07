export interface GrantBuilder {
  build(): {
    id: string;
    bookId: string;
    email: string;
    passwordHash: string | null;
    mode: string;
    allowed: boolean;
    commentsAllowed: boolean;
    offlineAllowed: boolean;
    expiresAt: string | null;
    invitedByUserId: string | null;
    createdAt: string;
    updatedAt: string;
    revokedAt: string | null;
  };
  withEmail(email: string): GrantBuilder;
  withMode(mode: string): GrantBuilder;
  withPassword(passwordHash: string): GrantBuilder;
  withCommentsAllowed(allowed: boolean): GrantBuilder;
  withOfflineAllowed(allowed: boolean): GrantBuilder;
  withExpiry(expiry: string): GrantBuilder;
  withRevoked(): GrantBuilder;
}

export function createGrantBuilder(): GrantBuilder {
  const state = {
    id: crypto.randomUUID(),
    bookId: crypto.randomUUID(),
    email: 'reader@example.com',
    passwordHash: null,
    mode: 'private',
    allowed: true,
    commentsAllowed: false,
    offlineAllowed: false,
    expiresAt: null,
    invitedByUserId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revokedAt: null,
  };

  return {
    build: () => ({ ...state }),
    withEmail: (email: string) => {
      state.email = email;
      return createGrantBuilder().withEmail(email);
    },
    withMode: (mode: string) => {
      state.mode = mode;
      return createGrantBuilder().withMode(mode);
    },
    withPassword: (passwordHash: string) => {
      state.passwordHash = passwordHash;
      return createGrantBuilder().withPassword(passwordHash);
    },
    withCommentsAllowed: (allowed: boolean) => {
      state.commentsAllowed = allowed;
      return createGrantBuilder().withCommentsAllowed(allowed);
    },
    withOfflineAllowed: (allowed: boolean) => {
      state.offlineAllowed = allowed;
      return createGrantBuilder().withOfflineAllowed(allowed);
    },
    withExpiry: (expiry: string) => {
      state.expiresAt = expiry;
      return createGrantBuilder().withExpiry(expiry);
    },
    withRevoked: () => {
      state.revokedAt = new Date().toISOString();
      return createGrantBuilder().withRevoked();
    },
  };
}

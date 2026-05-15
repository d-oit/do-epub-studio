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

interface GrantState {
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
}

export function createGrantBuilder(): GrantBuilder {
  let state: GrantState = {
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

  const self: GrantBuilder = {
    build: () => ({ ...state }),
    withEmail: (email: string) => {
      state = { ...state, email };
      return self;
    },
    withMode: (mode: string) => {
      state = { ...state, mode };
      return self;
    },
    withPassword: (passwordHash: string) => {
      state = { ...state, passwordHash };
      return self;
    },
    withCommentsAllowed: (allowed: boolean) => {
      state = { ...state, commentsAllowed: allowed };
      return self;
    },
    withOfflineAllowed: (allowed: boolean) => {
      state = { ...state, offlineAllowed: allowed };
      return self;
    },
    withExpiry: (expiry: string) => {
      state = { ...state, expiresAt: expiry };
      return self;
    },
    withRevoked: () => {
      state = { ...state, revokedAt: new Date().toISOString() };
      return self;
    },
  };

  return self;
}

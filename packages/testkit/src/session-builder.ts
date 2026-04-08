export interface SessionBuilder {
  build(): {
    id: string;
    bookId: string;
    email: string;
    sessionTokenHash: string;
    expiresAt: string;
    createdAt: string;
    revokedAt: string | null;
  };
  withEmail(email: string): SessionBuilder;
  withExpiry(minutesFromNow: number): SessionBuilder;
  withRevoked(): SessionBuilder;
}

interface SessionState {
  id: string;
  bookId: string;
  email: string;
  sessionTokenHash: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export function createSessionBuilder(): SessionBuilder {
  let state: SessionState = {
    id: crypto.randomUUID(),
    bookId: crypto.randomUUID(),
    email: 'reader@example.com',
    sessionTokenHash: 'hashed-token',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };

  return {
    build: () => ({ ...state }),
    withEmail: (email: string) => {
      state = { ...state, email };
      return createSessionBuilder();
    },
    withExpiry: (minutesFromNow: number) => {
      state = { ...state, expiresAt: new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString() };
      return createSessionBuilder();
    },
    withRevoked: () => {
      state = { ...state, revokedAt: new Date().toISOString() };
      return createSessionBuilder();
    },
  };
}

export function createExpiredSession() {
  return createSessionBuilder().withExpiry(-1);
}

export function createRevokedSession() {
  return createSessionBuilder().withRevoked();
}

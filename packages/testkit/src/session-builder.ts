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

export function createSessionBuilder(): SessionBuilder {
  const state = {
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
      state.email = email;
      return createSessionBuilder().withEmail(email);
    },
    withExpiry: (minutesFromNow: number) => {
      state.expiresAt = new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
      return createSessionBuilder().withExpiry(minutesFromNow);
    },
    withRevoked: () => {
      state.revokedAt = new Date().toISOString();
      return createSessionBuilder().withRevoked();
    },
  };
}

export function createExpiredSession() {
  return createSessionBuilder().withExpiry(-1);
}

export function createRevokedSession() {
  return createSessionBuilder().withRevoked();
}

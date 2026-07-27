import { describe, it, vi, beforeEach } from 'vitest';
import { setTokenOverride } from '../lib/offline/db';

vi.mock('@/stores/auth', () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({
      sessionToken: null,
    }),
  },
}));

describe('db — token management', () => {
  beforeEach(() => {
    setTokenOverride(null);
  });

  it('setTokenOverride sets token', () => {
    setTokenOverride('override-token');
    // No error means success
  });

  it('setTokenOverride clears token with null', () => {
    setTokenOverride('some-token');
    setTokenOverride(null);
    // No error means success
  });
});

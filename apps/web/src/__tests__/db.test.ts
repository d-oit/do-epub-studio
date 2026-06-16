import { describe, it, vi } from 'vitest';
import { setTokenOverride } from '../lib/offline/db';

vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue({
    transaction: vi.fn().mockReturnValue({
      objectStore: vi.fn().mockReturnValue({
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        getAll: vi.fn().mockResolvedValue([]),
      }),
    }),
    close: vi.fn(),
  }),
}));

vi.mock('../lib/offline/crypto', () => ({
  encryptJSON: vi.fn().mockResolvedValue('encrypted'),
  decryptJSON: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({
      sessionToken: 'test-token',
    }),
  },
}));

describe('setTokenOverride', () => {
  it('sets token override', () => {
    setTokenOverride('mock-token');
    // No error means success
  });

  it('clears token override', () => {
    setTokenOverride(null);
    // No error means success
  });
});

import { describe, it, expect, vi } from 'vitest';
import { generateMutationId, setPermissionRevokedCallback, cancelPendingRetry } from '../lib/offline/sync';

vi.mock('../lib/offline/db', () => ({
  addToSyncQueue: vi.fn(),
  getSyncQueue: vi.fn().mockResolvedValue([]),
  removeSyncQueueItem: vi.fn(),
  updateSyncQueueItem: vi.fn(),
  getUnsyncedProgress: vi.fn().mockResolvedValue([]),
  getUnsyncedAnnotations: vi.fn().mockResolvedValue([]),
  saveProgress: vi.fn(),
  saveAnnotation: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: {
    put: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../lib/offline/permissions', () => ({
  clearAllPermissions: vi.fn(),
}));

vi.mock('../lib/client-logger', () => ({
  logClientEvent: vi.fn(),
}));

describe('generateMutationId', () => {
  it('generates unique IDs', () => {
    const id1 = generateMutationId();
    const id2 = generateMutationId();
    expect(id1).not.toBe(id2);
  });

  it('generates valid UUID format', () => {
    const id = generateMutationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('setPermissionRevokedCallback', () => {
  it('sets callback', () => {
    const callback = vi.fn();
    setPermissionRevokedCallback(callback);
  });
});

describe('cancelPendingRetry', () => {
  it('cancels pending retry', () => {
    cancelPendingRetry();
  });
});

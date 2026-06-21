import { describe, it, expect, vi, beforeEach } from 'vitest';
import './fixtures';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
} from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';
import type { AuthContext } from '../auth/middleware';

vi.mock('../lib/tenant-isolation', () => ({
  parseLocatorRow: vi.fn(),
  assertBookAccess: vi.fn(),
}));

const mockAssertBookAccess = assertBookAccess as ReturnType<typeof vi.fn>;

const mockAuthContext: AuthContext = {
  email: 'user@example.com',
  bookId: '123e4567-e89b-12d3-a456-426614174000',
  sessionId: 'session-1',
  capabilities: { canRead: true, canComment: true, canHighlight: true, canBookmark: true, canDownloadOffline: true, canExportNotes: true, canManageAccess: false },
};

describe('insightsRouter', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
  });

  it('GET /api/books/:bookId/insights returns empty summary', async () => {
    mockRequireAuth.mockResolvedValue(mockAuthContext);
    mockQueryAll.mockResolvedValue([]);

    const res = await app.fetch(
      new Request('http://localhost/api/books/123e4567-e89b-12d3-a456-426614174000/insights', {
        headers: { 'Authorization': 'Bearer valid' },
      }),
      env,
      makePassThroughContext() as unknown as ExecutionContext,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.totalActiveMinutes).toBe(0);
  });

  it('POST /api/books/:bookId/insights/sync accepts valid payload', async () => {
    mockRequireAuth.mockResolvedValue(mockAuthContext);
    mockExecute.mockResolvedValue({});

    const res = await app.fetch(
      new Request('http://localhost/api/books/123e4567-e89b-12d3-a456-426614174000/insights/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid' },
        body: JSON.stringify({
          bookId: '123e4567-e89b-12d3-a456-426614174000',
          buckets: [{ date: '2026-06-19', activeMinutes: 15 }],
        }),
      }),
      env,
      makePassThroughContext() as unknown as ExecutionContext,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

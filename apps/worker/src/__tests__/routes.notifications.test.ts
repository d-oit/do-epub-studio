import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEnv, makeAuthContext, makePassThroughContext, mockQueryFirst, mockQueryAll, mockExecute, mockRequireAuth } from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({ parseLocatorRow: vi.fn(), assertBookAccess: vi.fn() }));
const mockAssertBookAccess = assertBookAccess as ReturnType<typeof vi.fn>;

describe('Notifications Routes', () => {
  const env = makeEnv();
  beforeEach(() => { vi.clearAllMocks(); mockAssertBookAccess.mockResolvedValue(null); });

  it('GET /api/notifications returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await app.fetch(new Request('http://localhost/api/notifications'), env, makePassThroughContext());
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications returns paginated list', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce({ cnt: 1 });
    mockQueryAll.mockResolvedValueOnce([
      { id: 'n1', user_email: 'user@example.com', book_id: 'b1', comment_id: 'c1', parent_comment_id: 'p1', type: 'reply', message: 'New reply', read_at: null, created_at: '2026-07-18T00:00:00Z' },
    ]);
    const res = await app.fetch(new Request('http://localhost/api/notifications', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { notifications: unknown[]; total: number } };
    expect(body.ok).toBe(true);
    expect(body.data.total).toBe(1);
  });

  it('GET /api/notifications/unread-count returns count', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce({ cnt: 3 });
    const res = await app.fetch(new Request('http://localhost/api/notifications/unread-count', { headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; data: { count: number } };
    expect(body.data.count).toBe(3);
  });

  it('POST /api/notifications/:id/read marks as read', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce({ id: 'n1', user_email: 'user@example.com' });
    const res = await app.fetch(new Request('http://localhost/api/notifications/n1/read', { method: 'POST', headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    expect(mockExecute).toHaveBeenCalled();
  });

  it('POST /api/notifications/:id/read returns 404 for missing', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValueOnce(null);
    const res = await app.fetch(new Request('http://localhost/api/notifications/nope/read', { method: 'POST', headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(404);
  });

  it('POST /api/notifications/read-all marks all as read', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const res = await app.fetch(new Request('http://localhost/api/notifications/read-all', { method: 'POST', headers: { Authorization: 'Bearer valid' } }), env, makePassThroughContext());
    expect(res.status).toBe(200);
    expect(mockExecute).toHaveBeenCalled();
  });
});
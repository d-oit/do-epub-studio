import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockRequireAdminAuth,
  mockStepUpAssured,
  mockLogAudit,
} from './fixtures';
import { app } from '../app';

const invitationMocks = vi.hoisted(() => ({
  createBookInvitation: vi.fn(),
  listBookInvitations: vi.fn(),
  resendBookInvitation: vi.fn(),
  revokeBookInvitation: vi.fn(),
  setInvitationDeliveryStatus: vi.fn(),
}));

vi.mock('../auth/invitations', () => invitationMocks);
vi.mock('../lib/email-transport', () => ({
  emailDeliveryConfigured: vi.fn(() => false),
  createEmailTransport: vi.fn(),
}));

const env = makeEnv();
const ctx = makePassThroughContext();
const bookId = '550e8400-e29b-41d4-a716-446655440000';

const invitation = {
  id: 'invite-1',
  bookId,
  email: 'reader@example.com',
  role: 'reader' as const,
  status: 'pending' as const,
  deliveryStatus: 'pending' as const,
  deliveryErrorCode: null,
  grantMode: 'private',
  commentsAllowed: false,
  offlineAllowed: false,
  grantExpiresAt: null,
  expiresAt: '2099-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  acceptedAt: null,
  revokedAt: null,
};

function adminRequest(path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-token',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('admin invitation routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
    invitationMocks.createBookInvitation.mockResolvedValue({ invitation, rawToken: 'a'.repeat(64) });
    invitationMocks.listBookInvitations.mockResolvedValue([invitation]);
    invitationMocks.resendBookInvitation.mockResolvedValue({ invitation, rawToken: 'b'.repeat(64) });
    invitationMocks.revokeBookInvitation.mockResolvedValue(undefined);
  });

  it('returns a manual copy link when email delivery is not configured', async () => {
    mockStepUpAssured();
    const response = await app.fetch(adminRequest(`/api/admin/books/${bookId}/invitations`, {
      bookId,
      email: 'reader@example.com',
      role: 'reader',
      mode: 'private',
      commentsAllowed: false,
      offlineAllowed: false,
    }), env, ctx);

    expect(response.status).toBe(201);
    const body: { ok: boolean; data: { delivery: string; copyUrl: string | null } } = await response.json();
    expect(body.data.delivery).toBe('manual_copy_required');
    expect(body.data.copyUrl).toContain('/accept-invite#token=');
    expect(mockLogAudit).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ entityType: 'book-invitation', action: 'created' }),
      expect.anything(),
    );
  });

  it('requires an elevated admin session for resend and revoke', async () => {
    mockStepUpAssured();
    const response = await app.fetch(adminRequest(`/api/admin/books/${bookId}/invitations/invite-1/resend`), env, ctx);
    expect(response.status).toBe(200);
    expect(invitationMocks.resendBookInvitation).toHaveBeenCalled();

    mockStepUpAssured();
    const revoke = await app.fetch(adminRequest(`/api/admin/books/${bookId}/invitations/invite-1/revoke`), env, ctx);
    expect(revoke.status).toBe(200);
    expect(invitationMocks.revokeBookInvitation).toHaveBeenCalled();
  });

  it('lists invitations without exposing a token', async () => {
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });
    const response = await app.fetch(new Request(`http://localhost/api/admin/books/${bookId}/invitations`, {
      headers: { Authorization: 'Bearer admin-token' },
    }), env, ctx);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain('token');
    expect(invitationMocks.listBookInvitations).toHaveBeenCalled();
  });
});

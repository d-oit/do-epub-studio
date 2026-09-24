import { apiRequest } from './core';

export type InvitationRole = 'reader' | 'creator';
export type InvitationStatus =
  'pending' | 'processing' | 'accepted' | 'revoked' | 'expired' | 'failed';
export type InvitationDeliveryStatus = 'pending' | 'sent' | 'manual_copy_required' | 'failed';

export interface BookInvitation {
  id: string;
  bookId: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  deliveryStatus: InvitationDeliveryStatus;
  deliveryErrorCode: string | null;
  grantMode: string;
  commentsAllowed: boolean;
  offlineAllowed: boolean;
  grantExpiresAt: string | null;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface CreateBookInvitationInput {
  bookId: string;
  email: string;
  role: InvitationRole;
  mode: string;
  commentsAllowed: boolean;
  offlineAllowed: boolean;
  expiresAt?: string;
}

export interface InvitationDeliveryResult {
  invitation: BookInvitation;
  delivery: InvitationDeliveryStatus;
  copyUrl: string | null;
}

export interface AcceptedInvitation {
  sessionToken: string;
  expiresAt: string;
  email: string;
  role: InvitationRole;
  book: {
    id: string;
    slug: string;
    title: string;
    authorName: string | null;
    visibility: string;
    coverImageUrl: string | null;
  };
  capabilities: {
    canRead: boolean;
    canComment: boolean;
    canHighlight: boolean;
    canBookmark: boolean;
    canDownloadOffline: boolean;
    canExportNotes: boolean;
    canManageAccess: boolean;
  };
}

export async function createBookInvitation(
  bookId: string,
  input: Omit<CreateBookInvitationInput, 'bookId'>,
  token: string,
): Promise<InvitationDeliveryResult> {
  return apiRequest<InvitationDeliveryResult>(`/api/admin/books/${bookId}/invitations`, {
    method: 'POST',
    token,
    body: JSON.stringify({ ...input, bookId }),
  });
}

export async function fetchBookInvitations(
  bookId: string,
  token: string,
): Promise<BookInvitation[]> {
  return apiRequest<BookInvitation[]>(`/api/admin/books/${bookId}/invitations`, { token });
}

export async function resendBookInvitation(
  bookId: string,
  invitationId: string,
  token: string,
): Promise<InvitationDeliveryResult> {
  return apiRequest<InvitationDeliveryResult>(
    `/api/admin/books/${bookId}/invitations/${invitationId}/resend`,
    { method: 'POST', token },
  );
}

export async function revokeBookInvitation(
  bookId: string,
  invitationId: string,
  token: string,
): Promise<{ id: string; status: 'revoked' }> {
  return apiRequest(`/api/admin/books/${bookId}/invitations/${invitationId}/revoke`, {
    method: 'POST',
    token,
  });
}

export async function acceptBookInvitation(
  token: string,
  newPassword: string,
  newPasswordConfirm: string,
): Promise<AcceptedInvitation> {
  return apiRequest<AcceptedInvitation>('/api/access/accept-invite', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword, newPasswordConfirm }),
  });
}

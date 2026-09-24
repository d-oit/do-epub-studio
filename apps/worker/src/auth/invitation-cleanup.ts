import type { Env } from '../lib/env';
import { transaction } from '../db/client';
import type { InvitationRole } from '@do-epub-studio/schema';

interface CleanupInvitation {
  id: string;
  book_id: string;
  email: string;
  role: InvitationRole;
}

export async function cleanupAcceptanceRace(
  env: Env,
  invitation: CleanupInvitation,
  userId: string,
  grantId: string,
): Promise<void> {
  const statements = [
    {
      sql: `UPDATE book_access_grants SET allowed = 0, revoked_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND book_id = ?`,
      args: [grantId, invitation.book_id],
    },
    {
      sql: `UPDATE reader_sessions SET revoked_at = datetime('now') WHERE book_id = ? AND lower(email) = ? AND revoked_at IS NULL`,
      args: [invitation.book_id, invitation.email],
    },
  ];
  if (invitation.role === 'creator') {
    statements.push({
      sql: `DELETE FROM book_creators WHERE book_id = ? AND user_id = ?`,
      args: [invitation.book_id, userId],
    });
  }
  statements.push({
    sql: `UPDATE book_invitations SET status = 'revoked', revoked_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status IN ('processing', 'accepted')`,
    args: [invitation.id],
  });
  await transaction(env, statements);
}

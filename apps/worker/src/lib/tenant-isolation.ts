import { MultiSignalLocatorSchema } from '@do-epub-studio/shared';
import { logAudit } from '../audit';
import { queryFirst } from '../db/client';
import type { Env, JsonRow } from './env';
import type { AuthContext } from '../auth/middleware';

interface GrantRow extends JsonRow {
  id: string;
  book_id: string;
  email: string;
  allowed: number;
}

export async function parseLocatorRow(
  env: Env,
  locatorJson: string | null,
  context: { entityType: string; entityId: string; bookId: string },
  ctx?: { waitUntil: (p: Promise<unknown>) => void },
): Promise<Record<string, unknown> | null> {
  if (!locatorJson) return null;

  try {
    const parsed: unknown = JSON.parse(locatorJson);
    const result = MultiSignalLocatorSchema.safeParse(parsed);

    if (!result.success) {
      await logAudit(
        env,
        {
          entityType: context.entityType as 'comment' | 'bookmark' | 'highlight',
          entityId: context.entityId,
          action: 'corrupt_locator',
          payload: {
            bookId: context.bookId,
            errors: result.error.issues.map((i) => i.message),
          },
        },
        ctx,
      );
      return null;
    }

    return result.data;
  } catch {
    await logAudit(
      env,
      {
        entityType: context.entityType as 'comment' | 'bookmark' | 'highlight',
        entityId: context.entityId,
        action: 'corrupt_locator',
        payload: {
          bookId: context.bookId,
          errors: ['Invalid JSON'],
        },
      },
      ctx,
    );
    return null;
  }
}

export async function assertBookAccess(
  env: Env,
  auth: AuthContext,
  urlBookId: string,
  ctx?: { waitUntil: (p: Promise<unknown>) => void },
): Promise<null | { ok: false; response: Response }> {
  if (auth.bookId === urlBookId) {
    return null;
  }

  const grant = await queryFirst<GrantRow>(
    env,
    `SELECT id, book_id, email, allowed
     FROM book_access_grants
     WHERE book_id = ? AND email = ? AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    [urlBookId, auth.email],
  );

  if (!grant || !grant.allowed) {
    await logAudit(
      env,
      {
        entityType: 'session',
        entityId: auth.sessionId,
        action: 'book_session_mismatch',
        actorEmail: auth.email,
        payload: {
          sessionBookId: auth.bookId,
          requestedBookId: urlBookId,
        },
      },
      ctx,
    );

    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          error: {
            code: 'BOOK_SESSION_MISMATCH',
            message: 'Session does not grant access to this book',
          },
        },
        { status: 403 },
      ),
    };
  }

  return null;
}

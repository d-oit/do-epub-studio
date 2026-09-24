import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AcceptBookInvitationSchema } from '@do-epub-studio/shared';
import type { Env } from '../lib/env';
import { acceptBookInvitation, type AcceptedInvitation } from '../auth/invitations';
import { createSession, hashToken } from '../auth/session';
import { computeCapabilities, getGrantByBookAndSession } from '../auth/password';
import { queryFirst } from '../db/client';
import { logAudit } from '../audit';
import { checkRateLimit } from '../lib/rate-limit-fallback';
import { apiError } from '../lib/api-error';
import { AppError } from '../lib/http-errors';

export const invitationsRouter = new Hono<{ Bindings: Env }>();

function clientIp(c: { req: { header(name: string): string | undefined } }): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

invitationsRouter.post(
  '/access/accept-invite',
  zValidator('json', AcceptBookInvitationSchema),
  async (c) => {
    const body = c.req.valid('json');
    const ipHash = await hashToken(clientIp(c));
    const ipLimit = await checkRateLimit(c.env, 'invite_accept_ip', ipHash, {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
    });
    const tokenHash = await hashToken(body.token);
    const tokenLimit = await checkRateLimit(c.env, 'invite_accept_token', tokenHash, {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipLimit.allowed || !tokenLimit.allowed) {
      return apiError(
        c,
        429,
        'TOO_MANY_REQUESTS',
        'Too many invitation attempts. Please try again later.',
      );
    }

    let accepted: AcceptedInvitation;
    try {
      accepted = await acceptBookInvitation(c.env, body);
    } catch (error) {
      await logAudit(
        c.env,
        {
          entityType: 'book-invitation',
          entityId: 'unknown',
          action: 'acceptance_denied',
          payload: { reason: error instanceof AppError ? error.code : 'unexpected' },
        },
        c.executionCtx,
      );
      throw error;
    }
    const book = await queryFirst<{
      id: string;
      slug: string;
      title: string;
      author_name: string | null;
      visibility: string;
      cover_image_url: string | null;
    }>(
      c.env,
      `SELECT id, slug, title, author_name, visibility, cover_image_url
       FROM books WHERE id = ? AND archived_at IS NULL LIMIT 1`,
      [accepted.bookId],
    );
    if (!book) {
      throw new AppError('This invitation cannot be accepted', 'INVITATION_INVALID', 410);
    }

    const grant = await getGrantByBookAndSession(c.env, accepted.bookId, accepted.email);
    if (!grant || (grant.expires_at && new Date(grant.expires_at) <= new Date())) {
      throw new AppError('This invitation cannot be accepted', 'INVITATION_INVALID', 410);
    }
    const session = await createSession(c.env, accepted.bookId, accepted.email);

    await logAudit(
      c.env,
      {
        entityType: 'book-invitation',
        entityId: accepted.invitationId,
        action: 'accepted',
        actorEmail: accepted.email,
        payload: { bookId: accepted.bookId, grantId: accepted.grantId },
      },
      c.executionCtx,
    );

    return c.json({
      ok: true,
      data: {
        sessionToken: session.token,
        expiresAt: session.expiresAt,
        email: accepted.email,
        role: accepted.role,
        book: {
          id: book.id,
          slug: book.slug,
          title: book.title,
          authorName: book.author_name,
          visibility: book.visibility,
          coverImageUrl: book.cover_image_url,
        },
        capabilities: computeCapabilities(grant),
      },
    });
  },
);

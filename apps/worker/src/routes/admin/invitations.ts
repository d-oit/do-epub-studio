import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateBookInvitationSchema, InvitationsListQuerySchema } from '@do-epub-studio/shared';
import type { Env } from '../../lib/env';
import {
  createBookInvitation,
  listBookInvitations,
  resendBookInvitation,
  revokeBookInvitation,
  setInvitationDeliveryStatus,
} from '../../auth/invitations';
import { createEmailTransport, emailDeliveryConfigured } from '../../lib/email-transport';
import { adminAuth } from '../../middleware/auth';
import { requireStepUp } from '../../middleware/step-up';
import { logAudit } from '../../audit';
import { logAppWarn, type RequestContext } from '../../lib/observability';
import { AppError } from '../../lib/http-errors';

export const invitationsAdminRouter = new Hono<{
  Bindings: Env;
  Variables: {
    adminUser: { email: string; id: string; role: string };
    requestContext: RequestContext;
  };
}>();

function baseUrl(env: Env): string {
  let value = env.APP_BASE_URL;
  while (value.endsWith('/')) value = value.slice(0, -1);
  return value;
}

function inviteUrl(env: Env, token: string): string {
  return `${baseUrl(env)}/accept-invite#token=${encodeURIComponent(token)}`;
}

async function deliver(
  env: Env,
  invitationId: string,
  email: string,
  bookTitle: string,
  token: string,
  context: RequestContext,
): Promise<{ status: 'sent' | 'manual_copy_required' | 'failed'; copyUrl: string | null }> {
  const url = inviteUrl(env, token);
  if (!emailDeliveryConfigured(env)) {
    await setInvitationDeliveryStatus(env, invitationId, 'manual_copy_required');
    return { status: 'manual_copy_required', copyUrl: url };
  }

  try {
    await createEmailTransport(env).send({
      to: email,
      subject: `Invitation to ${bookTitle}`,
      text: `You have been invited to access ${bookTitle} on d.o.EPUB Studio.\n\nAccept your invitation (valid for seven days): ${url}`,
      context,
    });
    await setInvitationDeliveryStatus(env, invitationId, 'sent');
    return { status: 'sent', copyUrl: null };
  } catch {
    await setInvitationDeliveryStatus(env, invitationId, 'failed', 'EMAIL_SEND_FAILED');
    logAppWarn('invitation.email_failed', { invitationId, code: 'EMAIL_SEND_FAILED' }, context);
    return { status: 'failed', copyUrl: url };
  }
}

invitationsAdminRouter.post(
  '/books/:bookId/invitations',
  adminAuth,
  requireStepUp,
  zValidator('json', CreateBookInvitationSchema),
  async (c) => {
    const bookId = c.req.param('bookId');
    const body = c.req.valid('json');
    if (body.bookId !== bookId) {
      throw new AppError('Book id does not match route', 'BOOK_ID_MISMATCH', 400);
    }
    const created = await createBookInvitation(c.env, body, c.get('adminUser').id);
    const book = await c.env.DB.prepare(`SELECT title FROM books WHERE id = ? LIMIT 1`)
      .bind(bookId)
      .first<{ title: string }>();
    const delivery = await deliver(
      c.env,
      created.invitation.id,
      created.invitation.email,
      book?.title ?? 'your book',
      created.rawToken,
      c.get('requestContext'),
    );
    await logAudit(
      c.env,
      {
        entityType: 'book-invitation',
        entityId: created.invitation.id,
        action: 'created',
        actorEmail: c.get('adminUser').email,
        payload: { bookId, role: created.invitation.role, delivery: delivery.status },
      },
      c.executionCtx,
    );
    return c.json(
      {
        ok: true,
        data: {
          invitation: { ...created.invitation, deliveryStatus: delivery.status },
          delivery: delivery.status,
          copyUrl: delivery.copyUrl,
        },
      },
      201,
    );
  },
);

invitationsAdminRouter.get(
  '/books/:bookId/invitations',
  adminAuth,
  zValidator('query', InvitationsListQuerySchema),
  async (c) => {
    const { limit, offset } = c.req.valid('query');
    return c.json({
      ok: true,
      data: await listBookInvitations(c.env, c.req.param('bookId'), limit, offset),
    });
  },
);

invitationsAdminRouter.post(
  '/books/:bookId/invitations/:invitationId/resend',
  adminAuth,
  requireStepUp,
  async (c) => {
    const bookId = c.req.param('bookId');
    const invitationId = c.req.param('invitationId');
    const resent = await resendBookInvitation(c.env, bookId, invitationId);
    const book = await c.env.DB.prepare(`SELECT title FROM books WHERE id = ? LIMIT 1`)
      .bind(bookId)
      .first<{ title: string }>();
    const delivery = await deliver(
      c.env,
      invitationId,
      resent.invitation.email,
      book?.title ?? 'your book',
      resent.rawToken,
      c.get('requestContext'),
    );
    await logAudit(
      c.env,
      {
        entityType: 'book-invitation',
        entityId: invitationId,
        action: 'resent',
        actorEmail: c.get('adminUser').email,
        payload: { bookId, delivery: delivery.status },
      },
      c.executionCtx,
    );
    return c.json({
      ok: true,
      data: {
        invitation: { ...resent.invitation, deliveryStatus: delivery.status },
        delivery: delivery.status,
        copyUrl: delivery.copyUrl,
      },
    });
  },
);

invitationsAdminRouter.post(
  '/books/:bookId/invitations/:invitationId/revoke',
  adminAuth,
  requireStepUp,
  async (c) => {
    const bookId = c.req.param('bookId');
    const invitationId = c.req.param('invitationId');
    await revokeBookInvitation(c.env, bookId, invitationId);
    await logAudit(
      c.env,
      {
        entityType: 'book-invitation',
        entityId: invitationId,
        action: 'revoked',
        actorEmail: c.get('adminUser').email,
        payload: { bookId },
      },
      c.executionCtx,
    );
    return c.json({ ok: true, data: { id: invitationId, status: 'revoked' } });
  },
);

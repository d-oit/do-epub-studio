import { Hono } from 'hono';
import type { Env } from '../../lib/env';
import type { RequestContext } from '../../lib/observability';
import { authRouter } from './auth';
import { booksRouter } from './books';
import { grantsRouter } from './grants';
import { creatorsAdminRouter } from './creators';
import { auditRouter } from './audit';
import { statsRouter } from './stats';
import { adminInsightsRouter } from './insights';
import { invitationsAdminRouter } from './invitations';

export const adminRouter = new Hono<{
  Bindings: Env;
  Variables: {
    adminUser: { email: string; id: string; role: string };
    requestContext: RequestContext;
  };
}>();

adminRouter.route('/', authRouter);
adminRouter.route('/books', booksRouter);
adminRouter.route('/', grantsRouter);
adminRouter.route('/', creatorsAdminRouter);
adminRouter.route('/', auditRouter);
adminRouter.route('/', statsRouter);
adminRouter.route('/', adminInsightsRouter);
adminRouter.route('/', invitationsAdminRouter);

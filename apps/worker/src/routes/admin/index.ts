import { Hono } from 'hono';
import type { Env } from '../../lib/env';
import { authRouter } from './auth';
import { booksRouter } from './books';
import { grantsRouter } from './grants';
import { auditRouter } from './audit';
import { statsRouter } from './stats';

export const adminRouter = new Hono<{ Bindings: Env; Variables: { adminUser: { email: string; id: string; role: string } } }>();

adminRouter.route('/', authRouter);
adminRouter.route('/books', booksRouter);
adminRouter.route('/', grantsRouter);
adminRouter.route('/', auditRouter);
adminRouter.route('/', statsRouter);

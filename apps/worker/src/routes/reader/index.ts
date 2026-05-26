import { Hono } from 'hono';
import type { Env } from '../../lib/env';
import type { AuthContext } from '../../auth/middleware';
import { progressRouter } from './progress';
import { bookmarksRouter } from './bookmarks';
import { highlightsRouter } from './highlights';

export const readerStateRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

readerStateRouter.route('/', progressRouter);
readerStateRouter.route('/', bookmarksRouter);
readerStateRouter.route('/', highlightsRouter);

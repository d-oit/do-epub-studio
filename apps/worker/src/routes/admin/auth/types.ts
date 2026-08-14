import type { Hono } from 'hono';
import type { Env } from '../../../lib/env';
import type { RequestContext } from '../../../lib/observability';

export type AuthApp = Hono<{
  Bindings: Env;
  Variables: { requestContext: RequestContext; adminUser: { email: string; id: string; role: string } };
}>;

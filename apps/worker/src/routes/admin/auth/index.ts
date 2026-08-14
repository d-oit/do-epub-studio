import { Hono } from 'hono';
import type { Env } from '../../../lib/env';
import type { RequestContext } from '../../../lib/observability';
import { registerLogin } from './login';
import { registerRecovery } from './recovery';
import { registerAccount } from './account';
import { registerMfa } from './mfa';
import type { AuthApp } from './types';

const authRouter: AuthApp = new Hono<{ Bindings: Env; Variables: { requestContext: RequestContext; adminUser: { email: string; id: string; role: string } } }>();

registerLogin(authRouter);
registerRecovery(authRouter);
registerAccount(authRouter);
registerMfa(authRouter);

export { authRouter };

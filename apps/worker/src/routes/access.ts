import { Hono, type Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import type { RequestContext } from '../lib/observability';
import {
  AccessRequestSchema,
  RecoveryRequestSchema,
  RecoveryVerifySchema,
} from '@do-epub-studio/shared';
import { ValidateQuerySchema } from '@do-epub-studio/schema';
import { apiError } from '../lib/api-error';
import { AccessGrantService } from '../services/access-grant.service';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

function getClientIp(c: { req: { header(name: string): string | undefined } }): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function serviceError(
  c: Context,
  result: { status?: number; error?: string; message?: string; headers?: Record<string, string> },
  defaultStatus = 400,
) {
  return apiError(
    c,
    (result.status ?? defaultStatus) as ContentfulStatusCode,
    result.error ?? 'BAD_REQUEST',
    result.message ?? 'Error',
    result.headers,
  );
}

export const accessRouter = new Hono<{
  Bindings: Env;
  Variables: { requestContext: RequestContext };
}>();

accessRouter.post('/recovery-request', zValidator('json', RecoveryRequestSchema), async (c) => {
  const { bookSlug, email } = c.req.valid('json');
  if (!bookSlug) return apiError(c, 400, 'MISSING_BOOK', 'Book slug is required');

  const result = await AccessGrantService.requestRecovery({
    env: c.env,
    bookSlug,
    email,
    clientIp: getClientIp(c),
    requestContext: c.get('requestContext'),
    executionCtx: c.executionCtx,
  });

  return result.ok ? c.json({ ok: true }) : serviceError(c, result, 400);
});

accessRouter.post('/verify-recovery', zValidator('json', RecoveryVerifySchema), async (c) => {
  const { token } = c.req.valid('json');

  const result = await AccessGrantService.verifyRecovery({
    env: c.env,
    token,
    clientIp: getClientIp(c),
    requestContext: c.get('requestContext'),
    executionCtx: c.executionCtx,
  });

  return result.ok ? c.json({ ok: true, data: result.data }) : serviceError(c, result, 401);
});

accessRouter.post('/request', zValidator('json', AccessRequestSchema), async (c) => {
  const { bookSlug, email, password } = c.req.valid('json');
  if (!bookSlug) return apiError(c, 400, 'MISSING_BOOK', 'Book slug is required');

  const result = await AccessGrantService.requestAccess({
    env: c.env,
    bookSlug,
    email,
    password,
    clientIp: getClientIp(c),
    executionCtx: c.executionCtx,
  });

  return result.ok ? c.json({ ok: true, data: result.data }) : serviceError(c, result, 401);
});

accessRouter.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';
  return c.json(await AccessGrantService.logout(c.env, token));
});

accessRouter.post('/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';
  const result = await AccessGrantService.refreshSession(c.env, token);

  return result.ok ? c.json({ ok: true, data: result.data }) : serviceError(c, result, 401);
});

accessRouter.get('/validate', zValidator('query', ValidateQuerySchema), async (c) => {
  const { bookId } = c.req.valid('query');
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';
  const result = await AccessGrantService.validateBookAccess(c.env, token, bookId);

  return result.ok ? c.json({ ok: true, data: result.data }) : serviceError(c, result, 401);
});

accessRouter.get('/validate-all', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';
  const result = await AccessGrantService.validateAllAccess(c.env, token);

  return result.ok ? c.json({ ok: true, data: result.data }) : serviceError(c, result, 401);
});

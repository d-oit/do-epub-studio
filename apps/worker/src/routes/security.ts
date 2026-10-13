import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { apiError } from '../lib/api-error';
import { CspReportSchema } from '@do-epub-studio/shared';
import { logAudit } from '../audit';

export const securityRouter = new Hono<{ Bindings: Env }>();

securityRouter.post('/csp-report', async (c) => {
  const rawBody: unknown = await c.req.raw.json().catch(() => null);
  const parsedBody = CspReportSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return apiError(c, 400, 'INVALID_PAYLOAD', 'Invalid CSP report payload');
  }

  const report = parsedBody.data;

  await logAudit(
    c.env,
    {
      entityType: 'session',
      entityId: 'csp-report',
      action: 'csp_violation',
      payload: report['csp-report'],
    },
    c.executionCtx,
  );

  return c.json({ ok: true }, 202);
});

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import { CspReportSchema } from '@do-epub-studio/shared';
import { logAudit } from '../audit';

export const securityRouter = new Hono<{ Bindings: Env }>();

securityRouter.post('/csp-report', zValidator('json', CspReportSchema), async (c) => {
  const report = c.req.valid('json');

  await logAudit(
    c.env,
    {
      entityType: 'session',
      entityId: 'csp-report',
      action: 'csp_violation',
      payload: report['csp-report'] as Record<string, unknown>,
    },
    c.executionCtx,
  );

  return c.json({ ok: true }, 202);
});

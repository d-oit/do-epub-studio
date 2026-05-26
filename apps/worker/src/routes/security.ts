import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import { CspReportSchema } from '@do-epub-studio/shared';

export const securityRouter = new Hono<{ Bindings: Env }>();

securityRouter.post('/csp-report', zValidator('json', CspReportSchema), (c) => {
  const report = c.req.valid('json');
  console.warn('CSP Violation Report:', JSON.stringify(report));
  return c.json({ ok: true }, 202);
});

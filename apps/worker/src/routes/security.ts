import { Hono } from 'hono';
import type { Env } from '../lib/env';

export const securityRouter = new Hono<{ Bindings: Env }>();

securityRouter.post('/csp-report', async (c) => {
  try {
    const report = await c.req.json();
    console.warn('CSP Violation Report:', JSON.stringify(report));
    return c.json({ ok: true }, 202);
  } catch {
    return c.json({ ok: false, error: 'Invalid report' }, 400);
  }
});

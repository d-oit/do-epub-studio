import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import { TelemetryPayloadSchema } from '@do-epub-studio/shared';
import { scrub } from '../lib/redact';

export const telemetryRouter = new Hono<{ Bindings: Env }>();

telemetryRouter.post(
  '/telemetry',
  zValidator('json', TelemetryPayloadSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: result.error.issues
              .map((i) => (i.path.length > 0 ? i.path.join('.') + ': ' : '') + i.message)
              .join('; '),
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const { logs } = c.req.valid('json');

    // Ensure we are using 'await' to satisfy linting, even if just for future-proofing
    await Promise.resolve();

    // For now, log to console. In a production environment, this could be
  // stored in a Durable Object, R2, or forwarded to an external observability service.
  for (const log of logs) {
    const scrubbedLog = scrub(log) as Record<string, unknown>;
    const output = JSON.stringify({
      ...scrubbedLog,
      _receivedAt: new Date().toISOString(),
      _remoteAddr: c.req.header('cf-connecting-ip') || 'unknown',
      _userAgent: c.req.header('user-agent'),
    });

    if (log.level === 'error') {
      console.error(`[CLIENT-TELEMETRY] ${output}`);
    } else if (log.level === 'warn') {
      console.warn(`[CLIENT-TELEMETRY] ${output}`);
    } else {
      console.log(`[CLIENT-TELEMETRY] ${output}`);
    }
  }

  return c.json({ ok: true }, 202);
});

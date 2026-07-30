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
  (c) => {
    const { logs } = c.req.valid('json');

    // Persist telemetry events to the database asynchronously
    const persistPromise = persistTelemetry(c.env, logs);
    if (c.executionCtx) {
      c.executionCtx.waitUntil(persistPromise);
    }

    // Also log to console for wrangler tail visibility (legacy behavior)
    for (const log of logs) {
      const scrubbedLog = scrub(log) as Record<string, unknown>;
      const receivedAt = new Date().toISOString();
      if (log.level === 'error') {
        console.error(JSON.stringify({ ...scrubbedLog, _receivedAt: receivedAt }));
      } else if (log.level === 'warn') {
        console.warn(JSON.stringify({ ...scrubbedLog, _receivedAt: receivedAt }));
      } else {
        console.log(JSON.stringify({ ...scrubbedLog, _receivedAt: receivedAt }));
      }
    }

    return c.json({ ok: true }, 202);
  },
);

interface TelemetryLogEntry {
  level: string;
  traceId: string;
  spanId?: string;
  event: string;
  metadata?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

async function persistTelemetry(env: Env, logs: TelemetryLogEntry[]): Promise<void> {
  // Guard: env.DB is required at the type level but may be absent
  // in test environments where the full Env bindings are not provided.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for test env
  if (!env.DB) return;

  const { execute } = await import('../db/client');
  const receivedAt = new Date().toISOString();

  for (const log of logs) {
    try {
      await execute(
        env,
        `INSERT INTO telemetry_events (id, level, trace_id, span_id, event, metadata_json, error_json, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          log.level,
          log.traceId,
          log.spanId ?? null,
          log.event,
          log.metadata ? JSON.stringify(scrub(log.metadata)) : null,
          log.error ? JSON.stringify(scrub(log.error)) : null,
          receivedAt,
        ],
      );
    } catch {
      // Persistence failures are non-critical — never break the response
    }
  }
}

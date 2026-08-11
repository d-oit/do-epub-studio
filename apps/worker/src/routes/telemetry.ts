import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env } from '../lib/env';
import type { RequestContext } from '../lib/observability';
import { TelemetryPayloadSchema } from '@do-epub-studio/shared';
import { scrub } from '../lib/redact';
import { logAppError, logAppInfo, logAppWarn } from '../lib/observability';
import { apiError } from '../lib/api-error';

export const telemetryRouter = new Hono<{ Bindings: Env; Variables: { requestContext: RequestContext } }>();

telemetryRouter.post(
  '/telemetry',
  zValidator('json', TelemetryPayloadSchema, (result, c) => {
    if (!result.success) {
      return apiError(
        c,
        400,
        'VALIDATION_ERROR',
        result.error.issues
          .map((i) => (i.path.length > 0 ? i.path.join('.') + ': ' : '') + i.message)
          .join('; '),
      );
    }
  }),
  (c) => {
    const { logs, dropped } = c.req.valid('json');
    const ingestCtx = c.get('requestContext');

    // Surface client-side drop pressure (Plan 212 O3): the client logger's
    // bounded buffer may drop entries when it overflows. Emit a structured
    // signal so the condition is observable. Fail-open — never throw for drops.
    if (typeof dropped === 'number' && dropped > 0) {
      logAppWarn(
        'telemetry.dropped',
        {
          dropped,
          _receivedAt: new Date().toISOString(),
          ingestTraceId: ingestCtx.traceId,
          ingestSpanId: ingestCtx.spanId,
        },
        ingestCtx,
      );
    }

    // Persist telemetry events to the database asynchronously
    const persistPromise = persistTelemetry(c.env, logs, ingestCtx);
    if (c.executionCtx) {
      c.executionCtx.waitUntil(persistPromise);
    }

    // Re-emit scrubbed telemetry via structured logging for wrangler tail visibility.
    // Preserve the client's severity so `wrangler tail --level error` still surfaces client errors.
    // Correlate trace IDs: ingest traceId from the server request context, client traceId from the payload.
    for (const log of logs) {
      const scrubbedLog = scrub(log) as Record<string, unknown>;
      const metadata = {
        ...scrubbedLog,
        _receivedAt: new Date().toISOString(),
        ingestTraceId: ingestCtx.traceId,
        ingestSpanId: ingestCtx.spanId,
        clientTraceId: sanitizeTraceId(log.traceId),
        clientSpanId: sanitizeTraceId(log.spanId ?? null),
      };
      if (log.level === 'error') {
        logAppError('telemetry.received', scrubbedLog.error ?? new Error('client telemetry error'), metadata, ingestCtx);
      } else if (log.level === 'warn') {
        logAppWarn('telemetry.received', metadata, ingestCtx);
      } else {
        logAppInfo('telemetry.received', metadata, ingestCtx);
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

async function persistTelemetry(
  env: Env,
  logs: TelemetryLogEntry[],
  ctx?: Pick<RequestContext, 'traceId' | 'spanId'>,
): Promise<void> {
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
          sanitizeTraceId(log.traceId),
          sanitizeTraceId(log.spanId ?? null),
          log.event,
          log.metadata ? JSON.stringify(scrub(log.metadata)) : null,
          log.error ? JSON.stringify(scrub(log.error)) : null,
          receivedAt,
        ],
      );
    } catch (err) {
      logAppWarn(
        'telemetry.persistence.failed',
        { event: log.event, level: log.level, errorMessage: err instanceof Error ? err.message : String(err) },
        ctx,
      );
    }
  }
}

/** Sanitize client-controlled trace IDs: truncate to 64 chars, strip non-hex. */
function sanitizeTraceId(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9a-fA-F]/g, '').slice(0, 64);
  return cleaned.length > 0 ? cleaned : null;
}

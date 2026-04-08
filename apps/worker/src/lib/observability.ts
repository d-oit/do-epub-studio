import {
  TRACE_HEADER,
  SPAN_HEADER,
  createTraceId,
  createSpanId,
  serializeError,
} from '@do-epub-studio/shared';

interface LogPayload {
  level: 'info' | 'error';
  traceId: string;
  spanId: string;
  event: string;
  method: string;
  path: string;
  status?: number;
  durationMs?: number;
  error?: ReturnType<typeof serializeError>;
  metadata?: Record<string, unknown>;
}

export interface RequestContext {
  traceId: string;
  spanId: string;
  startedAt: number;
  method: string;
  path: string;
}

export function createRequestContext(request: Request): RequestContext {
  const url = new URL(request.url);
  const traceId = request.headers.get(TRACE_HEADER) ?? createTraceId();
  const spanId = request.headers.get(SPAN_HEADER) ?? createSpanId();
  return {
    traceId,
    spanId,
    startedAt: Date.now(),
    method: request.method,
    path: url.pathname,
  };
}

function log(payload: LogPayload): void {
  const entry = JSON.stringify(payload);
  if (payload.level === 'error') {
    console.error(entry);
    return;
  }
  console.log(entry);
}

export function logRequestStart(ctx: RequestContext): void {
  log({
    level: 'info',
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    event: 'request.start',
    method: ctx.method,
    path: ctx.path,
  });
}

export function logRequestEnd(ctx: RequestContext, status: number): void {
  log({
    level: 'info',
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    event: 'request.complete',
    method: ctx.method,
    path: ctx.path,
    status,
    durationMs: Date.now() - ctx.startedAt,
  });
}

export function logRequestError(
  ctx: RequestContext,
  error: unknown,
  metadata?: Record<string, unknown>,
): void {
  log({
    level: 'error',
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    event: 'request.error',
    method: ctx.method,
    path: ctx.path,
    error: serializeError(error),
    metadata,
  });
}

export function withTraceHeaders(response: Response, ctx: RequestContext): Response {
  response.headers.set(TRACE_HEADER, ctx.traceId);
  response.headers.set(SPAN_HEADER, ctx.spanId);
  return response;
}

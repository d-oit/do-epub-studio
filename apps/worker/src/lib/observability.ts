import {
  TRACE_HEADER,
  SPAN_HEADER,
  TRACEPARENT_HEADER,
  createTraceId,
  createSpanId,
  serializeError,
  buildTraceparent,
  testBounded,
} from '@do-epub-studio/shared';
import { scrub } from './redact';

interface LogPayload {
  level: 'info' | 'warn' | 'error';
  traceId: string;
  spanId: string;
  event: string;
  method: string;
  path: string;
  status?: number;
  durationMs?: number;
  error?: ReturnType<typeof serializeError>;
  metadata?: Record<string, unknown>;
  route?: string;
  assetType?: string;
  fetchSource?: string;
  cacheStatus?: string;
}

export interface RequestContext {
  traceId: string;
  spanId: string;
  startedAt: number;
  method: string;
  path: string;
}

// Inbound trace/span headers are client-controlled input (Plan 214 R2).
// Bound length and charset before accepting them so an oversized or
// non-hex value is never echoed into response headers or logs verbatim.
const MAX_TRACE_ID_LENGTH = 64;
const MAX_SPAN_ID_LENGTH = 32;
const TRACE_ID_CHARSET = /^[0-9a-fA-F-]+$/;

/** Bounded scrub of a client-provided trace/span id for correlation-only metadata. */
function scrubClientId(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9a-fA-F-]/g, '').slice(0, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Validate a client-supplied trace/span header. Returns a valid id bound to
 * the server charset/length rules, minting a fresh server id when the client
 * value is missing or invalid. The scrubbed client value (if any) is returned
 * separately so callers can keep a correlation field without trusting it.
 */
function resolveInboundId(
  raw: string | null,
  maxLength: number,
  mint: () => string,
): { id: string; clientValue: string | null } {
  if (raw === null) return { id: mint(), clientValue: null };
  if (testBounded(TRACE_ID_CHARSET, raw, maxLength)) {
    return { id: raw, clientValue: raw };
  }
  return { id: mint(), clientValue: scrubClientId(raw, maxLength) };
}

export function createRequestContext(request: Request): RequestContext {
  const url = new URL(request.url);
  const trace = resolveInboundId(request.headers.get(TRACE_HEADER), MAX_TRACE_ID_LENGTH, createTraceId);
  const span = resolveInboundId(request.headers.get(SPAN_HEADER), MAX_SPAN_ID_LENGTH, createSpanId);
  return {
    traceId: trace.id,
    spanId: span.id,
    startedAt: Date.now(),
    method: request.method,
    path: url.pathname,
  };
}

function log(payload: LogPayload): void {
  const entry = JSON.stringify(scrub(payload));
  if (payload.level === 'error') {
    console.error(entry);
    return;
  }
  if (payload.level === 'warn') {
    console.warn(entry);
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

export function logRequestEnd(
  ctx: RequestContext,
  status: number,
  options?: {
    route?: string;
    assetType?: string;
    fetchSource?: string;
    cacheStatus?: string;
  },
): void {
  log({
    level: 'info',
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    event: 'request.complete',
    method: ctx.method,
    path: ctx.path,
    status,
    durationMs: Date.now() - ctx.startedAt,
    route: options?.route,
    assetType: options?.assetType,
    fetchSource: options?.fetchSource,
    cacheStatus: options?.cacheStatus,
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
  response.headers.set(TRACEPARENT_HEADER, buildTraceparent(ctx.traceId, ctx.spanId));
  return response;
}

/**
 * Log an error event without requiring a Request object.
 * Use for background operations (fire-and-forget DB updates, rate limiter errors, email transport).
 * When `context` is supplied (Plan 214 R3), the background log inherits the
 * initiating request's trace ids instead of minting a new unrelated trace.
 */
export function logAppError(
  event: string,
  error: unknown,
  metadata?: Record<string, unknown>,
  context?: Pick<RequestContext, 'traceId' | 'spanId'>,
): void {
  log({
    level: 'error',
    traceId: context?.traceId ?? createTraceId(),
    spanId: context?.spanId ?? createSpanId(),
    event,
    method: 'BACKGROUND',
    path: '-',
    error: serializeError(error),
    metadata,
  });
}

/**
 * Log an info event without requiring a Request object.
 * Use for background operations (email send logging, fallback warnings).
 * When `context` is supplied (Plan 214 R3), the background log inherits the
 * initiating request's trace ids instead of minting a new unrelated trace.
 */
export function logAppInfo(
  event: string,
  metadata?: Record<string, unknown>,
  context?: Pick<RequestContext, 'traceId' | 'spanId'>,
): void {
  log({
    level: 'info',
    traceId: context?.traceId ?? createTraceId(),
    spanId: context?.spanId ?? createSpanId(),
    event,
    method: 'BACKGROUND',
    path: '-',
    metadata,
  });
}

/**
 * Log a warn event without requiring a Request object.
 * Use for background operations that need warn-level visibility (wrangler tail --level warn).
 * When `context` is supplied (Plan 214 R3), the background log inherits the
 * initiating request's trace ids instead of minting a new unrelated trace.
 */
export function logAppWarn(
  event: string,
  metadata?: Record<string, unknown>,
  context?: Pick<RequestContext, 'traceId' | 'spanId'>,
): void {
  log({
    level: 'warn',
    traceId: context?.traceId ?? createTraceId(),
    spanId: context?.spanId ?? createSpanId(),
    event,
    method: 'BACKGROUND',
    path: '-',
    metadata,
  });
}

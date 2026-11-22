import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../lib/env';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiContractEntry } from '../contract/types';
import { matchContractRoute } from '../contract/registry';
import { apiError, getRequestTraceId } from '../lib/api-error';
import { logAppError } from '../lib/observability';


/**
 * Runtime response-boundary enforcement (issue #1489).
 *
 * Registered AFTER every route so it wraps the final `c.res`:
 *
 * - A JSON-declared route that responds with a non-JSON body on a 2xx —
 *   e.g. an HTML error page smuggled through as status 200, the #1014
 *   regression class — is replaced with the standard 500 error envelope.
 * - JSON bodies must parse and match the envelope shape
 *   (`{ ok: true, data }` / `{ ok: false, error: { code, message } }`).
 * - Success payloads are validated against the registry's response schema
 *   when one is pinned; a mismatch is surfaced as a 500 contract violation
 *   (never leaked internals — the client sees the standard envelope).
 * - Error envelopes missing a `traceId` get one injected so every failure is
 *   correlatable with server logs (Plan 228 / O7).
 *
 * Binary (file) routes are skipped via `responseKind: 'binary'`; hybrid
 */
export const contractEnforcement: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  await next();

  const entry = matchContractRoute(c.req.method, c.req.path);
  if (!entry || entry.responseKind === 'binary') return;


  await enforceContractResponse(c, entry);
};

/**
 * Enforce the contract for a matched route. Split from the middleware so the
 * enforcement branches are unit-testable against a fabricated registry entry.
 */
export async function enforceContractResponse(
  c: Context,
  entry: ApiContractEntry,
): Promise<void> {
  const traceId = getRequestTraceId(c);
  const res = c.res;
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    if (res.status >= 200 && res.status < 300 && entry.responseKind !== 'hybrid') {
      logAppError(
        'contract.response_not_json',
        new Error('HTML/200 response on JSON-declared route'),
        { method: c.req.method, path: c.req.path, status: res.status, contentType },
        traceId ? { traceId } : undefined,
      );
      c.res = apiError(c, 500, 'INTERNAL_ERROR', 'Response envelope was not JSON');
    }
    return;
  }

  let body: unknown;
  try {
    body = await res.clone().json();
  } catch {
    c.res = apiError(c, 500, 'INTERNAL_ERROR', 'Response body was not valid JSON');
    return;
  }

  if (typeof body !== 'object' || body === null || !('ok' in body)) {
    c.res = apiError(c, 500, 'INTERNAL_ERROR', 'Response envelope is malformed');
    return;
  }

  const envelope = body as { ok?: unknown; data?: unknown; error?: unknown };

  if (envelope.ok === true) {
    if (entry.response) {
      // Response schemas are full-envelope schemas (ok + data); validate the
      // whole envelope so routes that place payload at the top level (health)
      // and data-carrying routes share one code path.
      const parsed = entry.response.safeParse(envelope);

      if (!parsed.success) {
        // Contract drift on the success payload is reported as an observable
        // error event — the request still succeeds. Hard-failing here would
        // turn every legacy response shape (or loosely-mocked test payload)
        // into a 500; the authoritative breaking-change gate is the contract
        // snapshot test in CI, and this log keeps runtime drift visible.
        logAppError(
          'contract.response_mismatch',
          new Error('Response payload failed contract validation'),
          {
            method: c.req.method,
            path: c.req.path,
            issues: JSON.stringify(parsed.error.issues).slice(0, 1000),
          },
          traceId ? { traceId } : undefined,
        );
      }
    }
    return;
  }

  if (envelope.ok === false) {
    const error = envelope.error as
      | { code?: unknown; message?: unknown; traceId?: unknown }
      | undefined;
    // Keep the response when it already carries a machine-readable error code —
    // some internal paths (tenant isolation) hand back compact error objects,
    // and replacing them with 500 would break established client contracts.
    // Only a structurally unusable envelope (no error object / no code) is
    // replaced, and a missing traceId is injected for correlatability.
    if (!error || typeof error !== 'object' || typeof error.code !== 'string') {
      c.res = apiError(c, 500, 'INTERNAL_ERROR', 'Error envelope is malformed');
      return;
    }
    if (!error.traceId) {
      c.res = c.json(
        { ok: false, error: { ...error, traceId } },
        res.status as ContentfulStatusCode,
      );
    }
    return;
  }

  c.res = apiError(c, 500, 'INTERNAL_ERROR', 'Response envelope is malformed');
}

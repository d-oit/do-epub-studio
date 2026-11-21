/**
 * Transport adapter: swaps the global `fetch` for a shim that routes API
 * calls to the InMemorySyncServer. This is the seam that lets the real sync
 * engine (`syncItem` -> `annotation-sync` -> `apiRequest` -> `fetch`) execute
 * against the in-memory server contract without network or mocks.
 *
 * Failure injection is request-scoped: every global fetch goes through this
 * shim (remote peer writes bypass it and call the server directly), so each
 * directive is consumed by matching client requests and applied a bounded
 * number of times, preserving determinism.
 */

import { InMemorySyncServer, type ApplyResult } from './server';
import type { FailureDirective, RequestLogEntry } from './types';

export class Transport {
  readonly server = new InMemorySyncServer();

  readonly log: RequestLogEntry[] = [];

  directives: FailureDirective[] = [];

  authMode: 'enforce' | 'none' = 'enforce';

  private seq = 0;

  private originalFetch: typeof fetch | null = null;

  private installed = false;

  private response(status: number, payload: Record<string, unknown>): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  install(): () => void {
    if (this.installed) return () => {};
    this.originalFetch = globalThis.fetch;
    this.installed = true;
    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      Promise.resolve(this.dispatch(input, init));
    return () => this.uninstall();
  }

  uninstall(): void {
    if (!this.installed) return;
    if (this.originalFetch) globalThis.fetch = this.originalFetch;
    this.originalFetch = null;
    this.installed = false;
  }

  addDirective(directive: FailureDirective): void {
    this.directives.push(directive);
  }

  private dispatch(input: RequestInfo | URL, init?: RequestInit): Response {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
    );
    const method = (
      init?.method ?? (typeof input === 'string' ? 'GET' : (input as Request).method)
    ).toUpperCase();
    const headers = new Headers(init?.headers);
    const token = headers.get('authorization');
    const rawBody = init?.body;
    let body: Record<string, unknown> | null = null;
    if (typeof rawBody === 'string') {
      body = (JSON.parse(rawBody) as Record<string, unknown>) ?? null;
    }
    const path = url.pathname;
    const mutationId = body
      ? typeof body.mutationId === 'string'
        ? body.mutationId
        : null
      : null;

    if (this.authMode === 'enforce' && !token) {
      return this.response(401, {
        ok: false,
        error: { message: 'Session expired', code: 'UNAUTHORIZED' },
      });
    }

    const directive = this.directives.find((d) => d.times > 0 && path.includes(d.path));
    if (directive) directive.times -= 1;

    const apply = (): ApplyResult => this.server.applyRequest({ method, path, body });
    const logEntry = (status: number, result: ApplyResult, dropped = false): RequestLogEntry => {
      const entry: RequestLogEntry = {
        n: ++this.seq,
        source: 'client',
        method,
        path,
        mutationId,
        status,
        committed: result.committed,
        replay: result.replay,
        ...(result.errorCode ? { errorCode: result.errorCode } : {}),
        ...(dropped ? { droppedResponse: true } : {}),
      };
      this.log.push(entry);
      return entry;
    };

    if (directive?.kind === 'transient5xx') {
      const result = apply();
      logEntry(503, result);
      return this.response(503, {
        ok: false,
        error: { message: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' },
      });
    }
    if (directive?.kind === 'transientNetwork') {
      const result = apply();
      logEntry(0, result);
      throw new TypeError('Failed to fetch');
    }
    if (directive?.kind === 'lostAfterCommit') {
      const result = apply();
      logEntry(0, result, true);
      throw new TypeError('Failed to fetch (response lost after commit)');
    }
    if (directive?.kind === 'timeoutAfterCommit') {
      const result = apply();
      logEntry(0, result, true);
      const err = new Error('Request timeout');
      err.name = 'TimeoutError';
      throw err;
    }

    const result = apply();
    logEntry(result.status, result);
    return this.response(result.status, result.body);
  }
}

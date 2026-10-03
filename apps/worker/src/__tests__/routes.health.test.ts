import { describe, it, expect } from 'vitest';
import { makeEnv, makePassThroughContext } from './fixtures';
import { app } from '../app';

describe('Health Route', () => {
  const env = makeEnv();

  it('GET /api/health returns 200 JSON (ADR-252 liveness contract)', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/health'),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body: { ok: boolean; service: string } = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('do-epub-studio-worker');
  });

  it('unmatched routes return 404 JSON envelope (never plain text or HTML)', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/nonexistent-route'),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body: { ok: boolean; error: { code: string; message: string } } = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Endpoint not found');
  });
});

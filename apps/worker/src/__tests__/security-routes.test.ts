import { describe, it, expect } from 'vitest';
import { makeEnv, makePassThroughContext } from './fixtures';
import { app } from '../app';

describe('Security Routes', () => {
  const env = makeEnv();

  it('handles CSP report', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/csp-report', {
        method: 'POST',
        body: JSON.stringify({
          'csp-report': {
            'document-uri': 'http://example.com',
            'violated-directive': 'script-src',
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(202);
  });

  it('accepts browser CSP reports with application/csp-report content type', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/csp-report', {
        method: 'POST',
        body: JSON.stringify({
          'csp-report': {
            'document-uri': 'https://example.com/',
            'violated-directive': 'script-src',
          },
        }),
        headers: { 'Content-Type': 'application/csp-report' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(202);
  });

  it('returns a structured 400 when the CSP report fails schema validation', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/csp-report', {
        method: 'POST',
        body: JSON.stringify({
          'csp-report': {
            'document-uri': 'not a URL',
            'violated-directive': 'script-src',
          },
        }),
        headers: { 'Content-Type': 'application/csp-report' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD', message: 'Invalid CSP report payload' },
    });
  });

  it('returns a structured 400 when the CSP report body is malformed JSON', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/csp-report', {
        method: 'POST',
        body: '{"csp-report":',
        headers: { 'Content-Type': 'application/csp-report' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: { code: 'INVALID_PAYLOAD', message: 'Invalid CSP report payload' },
    });
  });
});

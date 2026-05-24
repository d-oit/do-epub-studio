import { describe, it, expect } from 'vitest';
import { makeEnv } from './fixtures';
import { app } from '../app';

describe('Security Routes', () => {
  const env = makeEnv();

  it('handles CSP report', async () => {
    const res = await app.fetch(new Request('http://localhost/api/csp-report', {
      method: 'POST',
      body: JSON.stringify({ 'csp-report': {} }),
      headers: { 'Content-Type': 'application/json' },
    }), env);

    expect(res.status).toBe(202);
  });
});

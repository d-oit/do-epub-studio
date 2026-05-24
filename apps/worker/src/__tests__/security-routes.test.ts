import { describe, it, expect } from 'vitest';
import { handleCspReport } from '../routes/security';
import type { Env } from '../lib/env';

describe('security routes', () => {
  it('handles CSP report', async () => {
    const mockEnv = {} as Env;
    const mockReport = { 'csp-report': { 'document-uri': 'http://example.com' } };
    const request = new Request('http://localhost/api/csp-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/csp-report' },
      body: JSON.stringify(mockReport),
    });

    const response = await handleCspReport(mockEnv, request);
    expect(response.status).toBe(204);
  });

  it('rejects invalid content type', async () => {
    const mockEnv = {} as Env;
    const request = new Request('http://localhost/api/csp-report', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'plain text',
    });

    const response = await handleCspReport(mockEnv, request);
    expect(response.status).toBe(400);
  });
});

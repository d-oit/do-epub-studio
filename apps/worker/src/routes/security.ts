import type { Env } from '../lib/env';
import { jsonResponse } from '../lib/responses';

/**
 * Handle Content Security Policy (CSP) violation reports.
 * Logs the violation details to the console/audit logs.
 */
export async function handleCspReport(env: Env, request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get('Content-Type');
    if (contentType !== 'application/csp-report' && !contentType?.includes('application/json')) {
       return jsonResponse({ ok: false, error: { code: 'INVALID_CONTENT_TYPE', message: 'Expected application/csp-report' } }, 400);
    }

    const report = await request.json();
    console.error('CSP Violation:', JSON.stringify(report));

    // In a real implementation, we would log this to a persistent store or external monitoring service.
    // For now, we emit the log which Cloudflare captures.

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to process CSP report:', error);
    return jsonResponse({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process report' } }, 500);
  }
}

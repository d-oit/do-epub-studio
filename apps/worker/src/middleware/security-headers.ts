import type { MiddlewareHandler } from 'hono';
import { applySecurityHeaders, applyMinimalSecurityHeaders } from '../lib/security-headers';

export const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  await next();

  // Apply appropriate security headers IF NOT ALREADY SET by route (like files)
  if (!c.res.headers.has('Content-Security-Policy')) {
    if (c.req.path.startsWith('/api/files/')) {
      applyMinimalSecurityHeaders(c.res);
    } else {
      applySecurityHeaders(c.res);
    }
  }
};

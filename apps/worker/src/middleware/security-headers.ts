import type { MiddlewareHandler } from 'hono';
import { applySecurityHeaders, applyMinimalSecurityHeaders } from '../lib/security-headers';

export const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  await next();

  // Apply appropriate security headers.
  // We always apply non-CSP headers. We skip the default CSP only if a route
  // (like files) already set a custom one.
  if (c.req.path.startsWith('/api/files/')) {
    applyMinimalSecurityHeaders(c.res, { skipCspIfPresent: true });
  } else {
    applySecurityHeaders(c.res, { skipCspIfPresent: true });
  }
};

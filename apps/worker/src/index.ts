/**
 * Monolithic router entry point.
 * All requests are delegated to the Hono app in app.ts, which manages
 * modularized route handlers and centralized input validation.
 */
import { RateLimiterDO } from './lib/rate-limiter-do';
import { app } from './app';

export { RateLimiterDO };

export default {
  fetch: app.fetch,
};

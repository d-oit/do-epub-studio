import { RateLimiterDO } from './lib/rate-limiter-do';
import { app } from './app';

export { RateLimiterDO };

export default {
  fetch: app.fetch,
};

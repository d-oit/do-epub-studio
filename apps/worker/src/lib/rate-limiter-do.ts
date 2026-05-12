/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from 'cloudflare:workers';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000,
};

export class RateLimiterDO extends DurableObject {
  async alarm(): Promise<void> {
    const now = Date.now();
    const entries = await this.ctx.storage.list<RateLimitEntry>();
    const expired = [...entries].filter(([, e]) => now >= e.resetAt).map(([k]) => k);

    if (expired.length > 0) {
      await this.ctx.storage.delete(expired);
    }

    const remaining = [...entries].filter(([, e]) => now < e.resetAt);
    if (remaining.length > 0) {
      const nextReset = Math.min(...remaining.map(([, e]) => e.resetAt));
      await this.ctx.storage.setAlarm(nextReset);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'POST' && path.startsWith('/reset/')) {
      return this.handleReset(path.slice('/reset/'.length));
    }

    const checkMatch = /^\/check\/([^/]+)\/([^/]+)$/.exec(path);
    if (request.method === 'GET' && checkMatch) {
      const maxRequests = parseInt(url.searchParams.get('maxRequests') ?? String(DEFAULT_CONFIG.maxRequests), 10);
      const windowMs = parseInt(url.searchParams.get('windowMs') ?? String(DEFAULT_CONFIG.windowMs), 10);
      return this.handleCheck(checkMatch[1], checkMatch[2], { maxRequests, windowMs });
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleCheck(
    namespace: string,
    key: string,
    config: RateLimitConfig,
  ): Promise<Response> {
    const entryKey = `${namespace}:${key}`;
    const now = Date.now();
    let entry = await this.ctx.storage.get<RateLimitEntry>(entryKey);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 1, resetAt: now + config.windowMs };
      await this.ctx.storage.put(entryKey, entry);

      const currentAlarm = await this.ctx.storage.getAlarm();
      if (currentAlarm === null || currentAlarm > entry.resetAt) {
        await this.ctx.storage.setAlarm(entry.resetAt);
      }

      return Response.json({
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: entry.resetAt,
      });
    }

    entry.count += 1;
    await this.ctx.storage.put(entryKey, entry);

    return Response.json({
      allowed: entry.count <= config.maxRequests,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetAt: entry.resetAt,
    });
  }

  private async handleReset(namespace: string): Promise<Response> {
    if (namespace) {
      const entries = await this.ctx.storage.list<RateLimitEntry>({ prefix: `${namespace}:` });
      const keys = [...entries.keys()];
      if (keys.length > 0) {
        await this.ctx.storage.delete(keys);
      }
    } else {
      await this.ctx.storage.deleteAll();
    }
    return new Response(null, { status: 204 });
  }
}

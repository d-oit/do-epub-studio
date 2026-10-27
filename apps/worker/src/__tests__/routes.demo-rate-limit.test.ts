import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEnv, makePassThroughContext, mockQueryFirst } from './fixtures';
import { app } from '../app';
import type { Env } from '../lib/env';

vi.mock('../lib/rate-limit-client', () => ({
  checkRateLimitDO: vi.fn().mockResolvedValue({ allowed: true, remaining: 0, resetAt: 0 }),
  deleteRateLimitKey: vi.fn(),
}));

describe('Pages demo login rate limits without Durable Objects', () => {
  let database: DatabaseSync;
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryFirst.mockResolvedValue(null);
    database = new DatabaseSync(':memory:');
    database.exec(`CREATE TABLE rate_limit_buckets (
      bucket_key TEXT PRIMARY KEY, window_started_at INTEGER NOT NULL,
      request_count INTEGER NOT NULL
    )`);
    const DB = {
      prepare(sql: string) {
        const statement = database.prepare(sql);
        return {
          bind(...args: (string | number | null)[]) {
            return {
              run: () => Promise.resolve(statement.run(...args)),
              first: () => Promise.resolve(statement.get(...args) ?? null),
            };
          },
        };
      },
    };
    env = {
      ...makeEnv(),
      DB,
      RATE_LIMITER: undefined,
      ENVIRONMENT: 'preview',
      CF_PAGES: '1',
      DEMO_LOGIN_ENABLED: '1',
      DEMO_ACCOUNTS_PROD_ALLOWLIST: 'demo-preview',
    } as unknown as Env;
  });

  afterEach(() => database.close());

  it.each(['reader-login', 'admin-login'])(
    'limits %s using real D1-compatible SQL',
    async (endpoint) => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await app.fetch(
          new Request(`http://localhost/api/demo/${endpoint}`, { method: 'POST' }),
          env,
          makePassThroughContext(),
        );
        // Missing accounts still consume quota, without minting a session.
        expect(response.status).toBe(403);
      }
      const blocked = await app.fetch(
        new Request(`http://localhost/api/demo/${endpoint}`, { method: 'POST' }),
        env,
        makePassThroughContext(),
      );
      expect(blocked.status).toBe(429);
      expect(await blocked.json()).toMatchObject({
        ok: false,
        error: { code: 'TOO_MANY_REQUESTS' },
      });
      expect(database.prepare('SELECT request_count FROM rate_limit_buckets').get()).toEqual({
        request_count: 11,
      });
    },
  );
});

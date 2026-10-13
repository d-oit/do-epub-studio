import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeEnv, mockQueryAll } from './fixtures';
import { onRequest } from '../../../web/functions/api/[[path]]';

vi.mock('../lib/register-argon2-wasm', () => ({
  registerArgon2Wasm: vi.fn().mockResolvedValue(undefined),
}));

describe('Pages Function adapter', () => {
  const env = makeEnv();
  const cache = {
    match: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('passes Pages waitUntil through Hono for catalog cache writes', async () => {
    vi.stubGlobal('caches', { default: cache });
    mockQueryAll.mockResolvedValueOnce([{ cnt: 0 }]).mockResolvedValueOnce([]);
    const pendingTasks: Promise<unknown>[] = [];
    const eventContext = {
      request: new Request('https://example.com/api/catalog'),
      env,
      waitUntil: vi.fn((promise: Promise<unknown>) => {
        pendingTasks.push(promise);
      }),
      passThroughOnException: vi.fn(),
    };

    const response = await onRequest(eventContext);

    expect(response.status).toBe(200);
    expect(eventContext.waitUntil).toHaveBeenCalledOnce();
    await Promise.all(pendingTasks);
    expect(cache.put).toHaveBeenCalledOnce();
  });
});

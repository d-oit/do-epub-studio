import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../lib/env';

const logInfo = vi.hoisted(() => vi.fn());
vi.mock('../lib/observability', () => ({ logAppInfo: logInfo }));

import { createEmailTransport, emailDeliveryConfigured } from '../lib/email-transport';

describe('email transport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not log invitation or recovery message bodies', async () => {
    const env = { APP_BASE_URL: 'https://app.example.com' } as unknown as Env;
    const token = 'a'.repeat(64);
    await createEmailTransport(env).send({
      to: 'reader@example.com',
      subject: 'Invitation',
      text: `Accept with token=${token}`,
    });

    expect(emailDeliveryConfigured(env)).toBe(false);
    const logged = JSON.stringify(logInfo.mock.calls);
    expect(logged).not.toContain(token);
    expect(logged).not.toContain('Accept with token');
  });
});

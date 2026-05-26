import { vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class MockDurableObject {
    ctx: unknown;
    constructor(ctx: unknown) {
      this.ctx = ctx;
    }
  },
}));

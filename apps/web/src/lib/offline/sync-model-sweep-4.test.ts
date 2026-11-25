import { describe, it } from 'vitest';
import { runQuickSweep } from './model/run';

describe('sync model quick sweep (seeds 76-100)', () => {
  it('keeps all invariants for seeds 76-100', async () => {
    await runQuickSweep(Array.from({ length: 25 }, (_, i) => i + 76));
  }, 300_000);
});

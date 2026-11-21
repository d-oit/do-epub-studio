import { describe, it } from 'vitest';
import { runQuickSweep } from './model/run';

describe('sync model quick sweep (seeds 1-25)', () => {
  it('keeps all invariants for seeds 1-25', async () => {
    await runQuickSweep(Array.from({ length: 25 }, (_, i) => i + 1));
  }, 300_000);
});

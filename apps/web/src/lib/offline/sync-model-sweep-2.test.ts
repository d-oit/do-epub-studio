import { describe, it } from 'vitest';
import { runQuickSweep } from './model/run';

describe('sync model quick sweep (seeds 26-50)', () => {
  it('keeps all invariants for seeds 26-50', async () => {
    await runQuickSweep(Array.from({ length: 25 }, (_, i) => i + 26));
  }, 300_000);
});

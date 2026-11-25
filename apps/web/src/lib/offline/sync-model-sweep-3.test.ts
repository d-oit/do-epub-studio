import { describe, it } from 'vitest';
import { runQuickSweep } from './model/run';

describe('sync model quick sweep (seeds 51-75)', () => {
  it('keeps all invariants for seeds 51-75', async () => {
    await runQuickSweep(Array.from({ length: 25 }, (_, i) => i + 51));
  }, 300_000);
});

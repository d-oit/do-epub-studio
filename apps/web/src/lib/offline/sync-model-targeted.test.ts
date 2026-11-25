import { describe, it } from 'vitest';
import { runDeepSeed } from './model/run';

const DEEP_SEEDS = [1337, 424242, 90210, 0xbeef, 0xfeed];

describe('sync model targeted deep seeds', () => {
  it('keeps all invariants on long randomized histories', async () => {
    const replaySeed = Number(process.env.REPLAY_SEED ?? '');
    if (replaySeed > 0) {
      await runDeepSeed(replaySeed);
      return;
    }
    for (const seed of DEEP_SEEDS) {
      await runDeepSeed(seed);
    }
  }, 600_000);
});

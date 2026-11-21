/**
 * Self-contained deterministic PRNG for the sync model suite (no deps).
 *
 * mulberry32: tiny, well-distributed, fully deterministic from a 32-bit
 * seed. All op generation in the suite draws from this one stream so a seed
 * reproduces the exact same op sequence in every run.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick from empty list');
    return items[this.int(0, items.length - 1)] as T;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

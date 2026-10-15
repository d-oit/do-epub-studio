export const MAX_RETRY_ATTEMPTS = 5;

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

export function calculateRetryDelay(attempt: number): number {
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  const capped = Math.min(delay, MAX_DELAY_MS);
  const randomValues = new Uint32Array(1);
  globalThis.crypto.getRandomValues(randomValues);
  const randomWord = randomValues[0] ?? 0;
  const randomFraction = randomWord / 0x1_0000_0000;
  const jitter = (randomFraction * 2 - 1) * (capped * 0.25);
  return Math.min(MAX_DELAY_MS, Math.floor(capped + jitter));
}

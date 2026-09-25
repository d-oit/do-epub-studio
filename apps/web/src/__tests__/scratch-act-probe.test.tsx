import { it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';

it('probe A: async act with a pending timer scheduled inside', async () => {
  // The whole point of this probe is an async act callback that does NOT await:
  // adding an `await` would change the microtask behaviour under measurement.
  // Scoped suppression, because `require-await` fires on a statement-bearing
  // body (probes B and C are empty and exempt) and the probe cannot satisfy it.
  // eslint-disable-next-line @typescript-eslint/require-await
  await act(async () => {
    setTimeout(() => {}, 3000);
  });
  expect(true).toBe(true);
});

it('probe B: async act while setTimeout is spied', async () => {
  const spy = vi.spyOn(globalThis, 'setTimeout');
  await act(async () => {});
  expect(true).toBe(true);
  spy.mockRestore();
});

it('probe C: async act alone', async () => {
  await act(async () => {});
  expect(true).toBe(true);
});

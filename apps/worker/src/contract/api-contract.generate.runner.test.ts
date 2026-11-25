import { it, expect } from 'vitest';
import {
  buildApiContract,
  readApiContractSnapshot,
  writeApiContractSnapshot,
} from './api-contract.generate';

/**
 * Generator runner used by `scripts/generate-api-contract.mjs`: builds the
 * contract snapshot and writes it to `apps/worker/api-contract.json`.
 *
 * The write is gated behind API_CONTRACT_REGENERATE (set only by the
 * generator script). A default test run must not mutate tracked files:
 * do-harness's strict evidence check fails the job when the workspace
 * fingerprint changes mid-run, and writing the snapshot races
 * `route-contract.test.ts`'s concurrent read. Instead a normal run
 * regenerates in memory and asserts it matches the committed snapshot.
 */
it('generates api-contract.json snapshot', () => {
  const generated = buildApiContract();
  if (!process.env.API_CONTRACT_REGENERATE) {
    const committed = readApiContractSnapshot();
    expect({ version: generated.version, routes: generated.routes }).toEqual({
      version: committed.version,
      routes: committed.routes,
    });
    return;
  }
  writeApiContractSnapshot(generated);
});

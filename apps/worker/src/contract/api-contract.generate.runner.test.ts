import { it } from 'vitest';
import { buildApiContract, writeApiContractSnapshot } from './api-contract.generate';

/**
 * Generator runner used by `scripts/generate-api-contract.mjs`: builds the
 * contract snapshot and writes it to `apps/worker/api-contract.json`.
 */
it('generates api-contract.json snapshot', () => {
  writeApiContractSnapshot(buildApiContract());
});

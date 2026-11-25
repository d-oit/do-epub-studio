#!/usr/bin/env node
/**
 * API contract snapshot generator (issue #1489).
 *
 * Rebuilds `apps/worker/api-contract.json` from the live Hono router and the
 * hand-maintained contract registry. Run after adding/changing public routes:
 *
 *   pnpm --filter @do-epub-studio/worker run generate-api-contract
 *
 * The output is committed; the snapshot test (`src/__tests__/route-contract.test.ts`)
 * fails on any drift so a breaking change requires this explicit update.
 */
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  execFileSync(
    'pnpm',
    ['exec', 'vitest', 'run', 'src/contract/api-contract.generate.runner.test.ts'],
    {
      cwd: workerDir,
      stdio: 'inherit',
      env: { ...process.env, API_CONTRACT_REGENERATE: '1' },
    },
  );
  console.log('api-contract.json written.');
} catch (error) {
  process.exitCode = 1;
  console.error('Failed to generate api-contract.json. Fix the registry/router drift first.');
  if (error instanceof Error) console.error(error.message);
}

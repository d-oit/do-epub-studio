import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ADR-279 commit-validator parity tests.
 *
 * scripts/lib/commit-types.sh claims to be the "single source of truth for
 * all commit validators" — this file makes that claim executable:
 *
 *  1. commitlint.config.cjs type-enum === COMMIT_TYPES (no drift in the list).
 *  2. commitlint never carries a rule stricter than scripts/hooks/commit-msg
 *     (scope-enum and case/full-stop/line-length rules stay off; no effective
 *     error-level rule outside the hook-parity allowlist).
 *  3. The hook's subject rules and its body requirement behave as CI assumes
 *     (including the `--subject-only` mode used for PR titles).
 *  4. The bash parity suite scripts/__tests__/commit-validator-parity.sh —
 *     previously unwired — actually runs, so hook/validate/regex agreement is
 *     enforced in CI, not merely documented.
 *
 * Runs via `pnpm vitest run scripts/__tests__` (ci.yml fast-check + unit).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const require = createRequire(import.meta.url);

const shellSource = readFileSync(resolve(repoRoot, 'scripts/lib/commit-types.sh'), 'utf8');
const commitlintConfig = require('../../commitlint.config.cjs');

/** Parse a `NAME=(\n "a"\n "b"\n)` bash array out of commit-types.sh. */
function shellArray(source, name) {
  const match = source.match(new RegExp(`^${name}=\\(([\\s\\S]*?)^\\)`, 'm'));
  if (!match) throw new Error(`${name} not found in commit-types.sh`);
  return [...match[1].matchAll(/"([^"]*)"/g)].map((entry) => entry[1]);
}

const typesFromShell = shellArray(shellSource, 'COMMIT_TYPES');

/** Effective commitlint rules: config-conventional merged with local overrides. */
const conventionalModule = require('@commitlint/config-conventional');
const conventionalRules = (conventionalModule.default ?? conventionalModule).rules;
const effectiveRules = { ...conventionalRules, ...commitlintConfig.rules };

/**
 * The only error-level rules commitlint may keep: each one enforces exactly
 * what scripts/hooks/commit-msg enforces (lowercase type from a fixed enum,
 * non-empty type + description, first line <= 72 chars). Adding a rule here
 * requires the hook to enforce it too (ADR-279).
 */
const HOOK_PARITY_ERROR_RULES = new Set([
  'type-enum',
  'header-max-length',
  'subject-empty',
  'type-empty',
  'type-case',
]);

/** Rules config-conventional turns on at level 2 but the hook does not. */
const HOOK_DIVERGENT_RULES = [
  'subject-case',
  'subject-full-stop',
  'body-max-line-length',
  'footer-max-line-length',
  'header-trim',
];

describe('commitlint.config.cjs mirrors scripts/lib/commit-types.sh (ADR-279)', () => {
  it('type-enum is exactly COMMIT_TYPES', () => {
    const typeEnum = commitlintConfig.rules['type-enum'];
    expect(typeEnum, 'type-enum rule missing').toBeDefined();
    expect(typeEnum[0]).toBe(2);
    expect([...typeEnum[2]].sort()).toEqual([...typesFromShell].sort());
    expect(typesFromShell.length).toBeGreaterThan(0);
    expect(new Set(typesFromShell).size).toBe(typesFromShell.length);
  });

  it('drops scope-enum: scopes are dynamic and the hook accepts any [a-z0-9_-]+', () => {
    expect(commitlintConfig.rules['scope-enum']).toBeUndefined();
  });

  it('caps the header at 72, the hook subject limit', () => {
    expect(commitlintConfig.rules['header-max-length']).toEqual([2, 'always', 72]);
  });

  it('explicitly disables every config-conventional rule the hook does not enforce', () => {
    // Omitting these would leave the stricter `extends` value active — they
    // must be declared at level 0.
    for (const rule of HOOK_DIVERGENT_RULES) {
      const declared = commitlintConfig.rules[rule];
      expect(declared, `${rule} must be explicitly overridden (level 0)`).toBeDefined();
      expect(declared[0], `${rule} must be disabled, not merely listed`).toBe(0);
    }
  });

  it('has no effective error-level rule outside the hook-parity allowlist', () => {
    const offenders = Object.entries(effectiveRules)
      .filter(
        ([rule, value]) =>
          Array.isArray(value) && value[0] >= 2 && !HOOK_PARITY_ERROR_RULES.has(rule),
      )
      .map(([rule]) => rule);
    expect(
      offenders,
      `commitlint is stricter than scripts/hooks/commit-msg: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});

describe('scripts/hooks/commit-msg contract used by CI (ADR-279)', () => {
  const hookPath = resolve(repoRoot, 'scripts/hooks/commit-msg');

  /** Run the hook against a message file; returns the exit status. */
  function runHook(flagArgs, message) {
    const dir = mkdtempSync(join(tmpdir(), 'commit-parity-'));
    const file = join(dir, 'commit-msg');
    writeFileSync(file, message);
    try {
      const result = spawnSync('bash', [hookPath, ...flagArgs, file], {
        encoding: 'utf8',
        cwd: repoRoot,
        timeout: 10_000,
      });
      return result.status;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('--subject-only accepts a valid single-line PR title', () => {
    expect(runHook(['--subject-only'], 'feat(reader): add highlighting\n')).toBe(0);
  });

  it('--subject-only still rejects a >72-char PR title', () => {
    const long = 'chore: bump the production-dependencies group across 1 directory with 4 updates';
    expect(long.length).toBeGreaterThan(72);
    expect(runHook(['--subject-only'], `${long}\n`)).toBe(1);
  });

  it('--subject-only still rejects a non-conventional PR title', () => {
    expect(runHook(['--subject-only'], 'Update the reader\n')).toBe(1);
  });

  it('full mode (CI commit-range + local git hook) still requires a body', () => {
    expect(runHook([], 'feat(reader): add highlighting\n')).toBe(1);
    expect(runHook([], 'feat(reader): add highlighting\n\nWhy: ADR-006.\n')).toBe(0);
  });
});

describe('bash commit-validator parity suite is enforced', () => {
  it('scripts/__tests__/commit-validator-parity.sh passes', () => {
    const suite = resolve(repoRoot, 'scripts/__tests__/commit-validator-parity.sh');
    const result = spawnSync('bash', [suite], {
      encoding: 'utf8',
      cwd: repoRoot,
      timeout: 120_000,
    });
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);
  }, 120_000);
});

import { describe, it, expect } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  findDuplicatePullRequests,
  formatDuplicateReport,
  normalizeTitle,
  runSelfTest,
} from '../check-duplicate-prs.mjs';

// GOAP-276 Phase 2 — "Duplicate-PR pre-flight guard (scheduled detection
// workflow)". These tests pin the conservative matching rule and prove the
// detector is not vacuous. They are hermetic: the fixture is a local JSON
// file shaped like the GitHub REST API response, so no network is needed.

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, '../check-duplicate-prs.mjs');
const repoRoot = resolve(__dirname, '../..');
const fixturePath = resolve(__dirname, 'fixtures/open-pull-requests.json');

function runScript(args = []) {
  return spawnSync('node', [scriptPath, ...args], { cwd: repoRoot, encoding: 'utf8' });
}

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

describe('check-duplicate-prs.mjs — matching rule', () => {
  it('matches a normalized-identical title on the same base branch', () => {
    const groups = findDuplicatePullRequests([
      { number: 1, title: 'fix: crash on startup', base: { ref: 'main' } },
      { number: 2, title: 'FIX:   Crash on startup ', base: { ref: 'main' } },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].baseRef).toBe('main');
    expect(groups[0].pullRequests.map((pull) => pull.number)).toEqual([1, 2]);
  });

  it('does not match the same title on a different base branch', () => {
    const groups = findDuplicatePullRequests([
      { number: 1, title: 'fix: crash on startup', base: { ref: 'main' } },
      { number: 2, title: 'fix: crash on startup', base: { ref: 'release/1.x' } },
    ]);

    expect(groups).toHaveLength(0);
  });

  it('does not match different titles on the same base branch', () => {
    const groups = findDuplicatePullRequests([
      { number: 1, title: 'fix: crash on startup', base: { ref: 'main' } },
      { number: 2, title: 'docs: update the README', base: { ref: 'main' } },
    ]);

    expect(groups).toHaveLength(0);
  });

  it('never treats a conventional-commit prefix difference as a duplicate', () => {
    // The rule is exact normalized-title equality: stripping a scope or a
    // type prefix would raise the false-positive rate of a check that turns a
    // scheduled run red, so it is deliberately not part of the rule.
    const groups = findDuplicatePullRequests([
      { number: 1, title: 'fix: crash on startup', base: { ref: 'main' } },
      { number: 2, title: 'feat: crash on startup', base: { ref: 'main' } },
    ]);

    expect(groups).toHaveLength(0);
  });

  it('ignores pull requests without a usable base branch or title', () => {
    const groups = findDuplicatePullRequests([
      { number: 1, title: 'fix: crash', base: {} },
      { number: 2, title: 'fix: crash', base: {} },
      { number: 3, title: '   ', base: { ref: 'main' } },
      { number: 4, title: '', base: { ref: 'main' } },
      { number: 5, title: 'fix: crash', base: { ref: 'main' } },
    ]);

    // Only #5 survives normalization, so there is no group of two.
    expect(groups).toHaveLength(0);
  });

  it('normalizes case, full-width characters and whitespace runs', () => {
    expect(normalizeTitle('Fix: Crash')).toBe('fix: crash');
    expect(normalizeTitle('ＦＩＸ： Crash')).toBe('fix: crash');
    expect(normalizeTitle('fix:   crash')).toBe('fix: crash');
    expect(normalizeTitle('  fix: crash  ')).toBe('fix: crash');
    expect(normalizeTitle(undefined)).toBe('');
  });

  it('strips control characters so a title cannot break out of the report', () => {
    expect(normalizeTitle('fix:\u0007 crash')).toBe('fix: crash');
    expect(normalizeTitle('fix:\n crash')).toBe('fix: crash');
  });

  it('groups the fixture into exactly one duplicate group', () => {
    const groups = findDuplicatePullRequests(fixture.pulls);

    expect(groups).toHaveLength(1);
    expect(groups[0].baseRef).toBe('main');
    // #101 and #102 are the duplicate pair (same title, same base). #103/#104
    // share a title but sit on different base branches, #105/#106 differ.
    expect(groups[0].pullRequests.map((pull) => pull.number)).toEqual([101, 102]);
  });
});

describe('check-duplicate-prs.mjs — report', () => {
  it('names the pull-request numbers and URLs of every match', () => {
    const groups = findDuplicatePullRequests(fixture.pulls);
    const report = formatDuplicateReport(groups, {
      repo: fixture.repo,
      total: fixture.pulls.length,
    });

    expect(report).toContain('#101');
    expect(report).toContain('#102');
    // The expected URLs are built rather than written as literals: a literal
    // URL inside a containment assertion reads to a static analyzer like a
    // substring check on a sanitized URL, which is what its "incomplete URL
    // substring sanitization" rule flags.
    for (const number of [101, 102]) {
      expect(report).toContain(`https://github.com/example/repo/pull/${number}`);
    }
    expect(report).toContain('base `main`');
  });

  it('reports a clean run without claiming duplicates', () => {
    const report = formatDuplicateReport([], { repo: fixture.repo, total: 0 });

    expect(report).toContain('No duplicates found');
    expect(report).not.toContain('https://github.com/');
  });

  it('does not autolink a URL outside the trusted GitHub prefix', () => {
    const groups = findDuplicatePullRequests([
      { number: 1, title: 'fix: crash', base: { ref: 'main' }, html_url: 'https://evil.example/1' },
      { number: 2, title: 'fix: crash', base: { ref: 'main' }, html_url: 'https://evil.example/2' },
    ]);
    const report = formatDuplicateReport(groups, { repo: fixture.repo, total: 2 });

    expect(report).not.toContain('https://evil.example/');
    expect(report).toContain('#1');
  });
});

describe('check-duplicate-prs.mjs — CLI', () => {
  it('fails with exit code 1 on the fixture and reports the duplicate pair', () => {
    const result = runScript(['--input', fixturePath, '--repo', fixture.repo]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('#101');
    expect(result.stdout).toContain('#102');
    expect(result.stderr).toContain('duplicate group(s) found');
  });

  it('exits 0 when no duplicates are present', () => {
    const tempDir = resolve(__dirname, 'temp-duplicate-prs');
    const cleanFixture = resolve(tempDir, 'clean.json');
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      cleanFixture,
      JSON.stringify({
        pulls: [
          { number: 1, title: 'fix: one', base: { ref: 'main' } },
          { number: 2, title: 'fix: two', base: { ref: 'main' } },
        ],
      }),
    );
    try {
      const result = runScript(['--input', cleanFixture]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('No duplicates found');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('exits 2 on a malformed input file', () => {
    const result = runScript(['--input', resolve(__dirname, 'fixtures/does-not-exist.json')]);

    expect(result.status).toBe(2);
  });

  it('runs the hermetic self-test without any input file', () => {
    const result = runScript(['--self-test']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('self-test passed');
  });

  it('has a self-test that covers a duplicate, a different base and a non-duplicate', () => {
    expect(runSelfTest()).toEqual([]);
  });
});

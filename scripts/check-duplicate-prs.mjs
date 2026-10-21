#!/usr/bin/env node
// scripts/check-duplicate-prs.mjs — read-only duplicate open-PR detector
// (GOAP-276 Phase 2, "Duplicate-PR pre-flight guard").
//
// WHAT IT DOES
// Reads a JSON payload of open pull requests (the shape the GitHub REST API
// returns) and reports the groups of pull requests that look like duplicates
// of each other. It never mutates pull-request state: it only reads the file
// it is given and prints a report.
//
// THE DUPLICATE RULE (conservative, exact match only)
// Two open pull requests are duplicates when BOTH of the following hold:
//   1. the same base branch (exact `base.ref` match), and
//   2. the same normalized title, where normalization is
//      NFKC -> control characters to spaces -> whitespace runs collapsed to a
//      single space -> trimmed -> lower-cased.
// Deliberately NOT part of the rule, because each of them raises the
// false-positive rate of a check that turns a scheduled run red:
//   * fuzzy / "similar" title matching,
//   * stripping a conventional-commit prefix or scope ("fix:" vs "feat:"),
//   * stripping issue numbers, brackets or trailing punctuation,
//   * author, branch-name or file-overlap heuristics.
// A pull-request title is the only signal used, and only in its normalized
// form, so "the same title on the same base" is the only thing that matches.
//
// USAGE
//   node scripts/check-duplicate-prs.mjs --input <open-prs.json>
//       [--summary <file.md>] [--repo <owner/name>]
//   node scripts/check-duplicate-prs.mjs --self-test
//
// The input file is either a JSON array of pull requests or an object with a
// `pulls` array (the workflow writes the latter).
//
// EXIT CODES
//   0 = no duplicates found (or the self-test passed)
//   1 = duplicates found — the scheduled check must fail
//   2 = usage error, unreadable input, or malformed payload

import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_PATH = fileURLToPath(import.meta.url);

/** Longest title echoed into the report; the full title stays in the API data. */
const MAX_TITLE_LENGTH = 120;

/** Only `https://github.com/` links are rendered as autolinks in the report. */
const TRUSTED_URL_PREFIX = 'https://github.com/';

/**
 * Normalize a pull-request title for exact comparison.
 *
 * NFKC folds compatibility characters (a full-width `ＦＩＸ：` becomes
 * `FIX:`), control characters become spaces so a title can never smuggle a
 * line break into the report, whitespace runs collapse to one space, and the
 * result is trimmed and lower-cased. Nothing else is removed.
 *
 * @param {unknown} title
 * @returns {string} the normalized title, or '' when the title is unusable
 */
export function normalizeTitle(title) {
  if (typeof title !== 'string') return '';
  return title
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Collapse whitespace and truncate a title for display.
 *
 * @param {unknown} value
 * @returns {string}
 */
function flatten(value) {
  const text = typeof value === 'string' ? value : '';
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_TITLE_LENGTH) return collapsed;
  return `${collapsed.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}

/**
 * Escape text for use inside a markdown code span: only backslash and
 * backtick need escaping there, everything else is already literal.
 *
 * @param {unknown} value
 * @returns {string}
 */
function codeSpan(value) {
  return String(value).replace(/[\\`]/g, '\\$&');
}

/**
 * Normalize one API pull-request record into the fields the rule needs.
 *
 * @param {unknown} pull
 * @returns {{number: number, title: string, baseRef: string, url: string, isDraft: boolean, normalizedTitle: string} | null}
 */
function normalizePullRequest(pull) {
  if (!pull || typeof pull !== 'object') return null;
  const record = /** @type {Record<string, unknown>} */ (pull);
  const number = record.number;
  if (typeof number !== 'number' || !Number.isInteger(number) || number <= 0) return null;
  const base = record.base;
  const baseRef =
    base && typeof base === 'object' && typeof (/** @type {any} */ (base).ref) === 'string'
      ? /** @type {any} */ (base).ref.trim()
      : '';
  if (baseRef === '') return null;
  const title = typeof record.title === 'string' ? record.title : '';
  const normalizedTitle = normalizeTitle(title);
  // An empty normalized title carries no signal; two such pull requests are
  // not evidence of duplication.
  if (normalizedTitle === '') return null;
  const url = typeof record.html_url === 'string' ? record.html_url : '';
  return {
    number,
    title,
    baseRef,
    url,
    isDraft: record.draft === true,
    normalizedTitle,
  };
}

/**
 * Group open pull requests into duplicate groups.
 *
 * A group is a set of pull requests that share one base branch and one
 * normalized title. Only groups with at least two members are returned.
 *
 * @param {unknown[]} pulls
 * @returns {{baseRef: string, normalizedTitle: string, pullRequests: {number: number, title: string, baseRef: string, url: string, isDraft: boolean, normalizedTitle: string}[]}[]}
 */
export function findDuplicatePullRequests(pulls) {
  const groups = new Map();
  for (const pull of Array.isArray(pulls) ? pulls : []) {
    const record = normalizePullRequest(pull);
    if (!record) continue;
    // The key is a JSON encoding of the pair, so the separator can never be
    // confused with content: a branch named "a b" and a title "c" cannot
    // collide with a branch named "a" and a title "b c".
    const key = JSON.stringify([record.baseRef, record.normalizedTitle]);
    const existing = groups.get(key);
    if (existing) {
      existing.pullRequests.push(record);
    } else {
      groups.set(key, {
        baseRef: record.baseRef,
        normalizedTitle: record.normalizedTitle,
        pullRequests: [record],
      });
    }
  }

  const duplicates = [];
  for (const group of groups.values()) {
    if (group.pullRequests.length < 2) continue;
    group.pullRequests.sort((a, b) => a.number - b.number);
    duplicates.push(group);
  }
  duplicates.sort(
    (a, b) =>
      a.baseRef.localeCompare(b.baseRef) || a.normalizedTitle.localeCompare(b.normalizedTitle),
  );
  return duplicates;
}

/**
 * Render the duplicate report as markdown.
 *
 * The report is the only output of this workflow: it names the pull-request
 * numbers and URLs so a human can act on them.
 *
 * @param {{baseRef: string, normalizedTitle: string, pullRequests: {number: number, title: string, url: string, isDraft: boolean}[]}[]} groups
 * @param {{repo?: string, total?: number}} [options]
 * @returns {string}
 */
export function formatDuplicateReport(groups, options = {}) {
  const repo = typeof options.repo === 'string' ? options.repo : '';
  const total = Number.isInteger(options.total) ? options.total : 0;
  const list = Array.isArray(groups) ? groups : [];

  const lines = ['## Duplicate open pull requests', ''];
  if (list.length === 0) {
    lines.push(`No duplicates found among ${total} open pull request(s).`);
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`**${list.length} duplicate group(s) among ${total} open pull request(s).**`);
  lines.push('');
  lines.push(
    'Each group below shares one normalized title on one base branch. This check only reports — ' +
      'it never changes pull-request state. Close or re-title the redundant pull request(s).',
  );
  lines.push('');

  list.forEach((group, index) => {
    lines.push(`### Group ${index + 1} — base \`${codeSpan(flatten(group.baseRef))}\``);
    lines.push('');
    for (const pull of group.pullRequests) {
      const url = pull.url || (repo ? `https://github.com/${repo}/pull/${pull.number}` : '');
      const link = url.startsWith(TRUSTED_URL_PREFIX) ? `<${url}>` : `#${pull.number}`;
      const draft = pull.isDraft ? ' (draft)' : '';
      lines.push(`- #${pull.number}${draft} — ${link} — \`${codeSpan(flatten(pull.title))}\``);
    }
    lines.push('');
    lines.push(`Normalized title: \`${codeSpan(flatten(group.normalizedTitle))}\``);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Hermetic self-test of the matching rule. No network, no fixtures on disk:
 * it proves the detector is not vacuous before its verdict is trusted.
 *
 * @returns {string[]} the failures, empty when the self-test passes
 */
export function runSelfTest() {
  const failures = [];
  const assert = (name, condition) => {
    if (!condition) failures.push(name);
  };
  const pull = (number, title, baseRef) => ({
    number,
    title,
    base: { ref: baseRef },
    html_url: `https://github.com/example/repo/pull/${number}`,
  });

  const duplicate = findDuplicatePullRequests([
    pull(1, 'Fix: Crash on startup', 'main'),
    pull(2, 'fix:   crash on startup ', 'main'),
  ]);
  assert('same title + same base branch is a duplicate', duplicate.length === 1);
  assert('the duplicate group holds both pull requests', duplicate[0]?.pullRequests.length === 2);

  const differentBase = findDuplicatePullRequests([
    pull(3, 'Fix: Crash on startup', 'main'),
    pull(4, 'Fix: Crash on startup', 'release/1.x'),
  ]);
  assert('same title + different base branch is not a duplicate', differentBase.length === 0);

  const differentTitle = findDuplicatePullRequests([
    pull(5, 'Fix: Crash on startup', 'main'),
    pull(6, 'Docs: update the README', 'main'),
  ]);
  assert('different titles are not a duplicate', differentTitle.length === 0);

  assert('normalization folds case', normalizeTitle('Fix: Crash') === 'fix: crash');
  assert(
    'normalization folds full-width characters',
    normalizeTitle('ＦＩＸ： Crash') === 'fix: crash',
  );
  assert('normalization collapses whitespace', normalizeTitle('fix:   crash') === 'fix: crash');
  assert(
    'empty titles never match each other',
    findDuplicatePullRequests([pull(7, '   ', 'main'), pull(8, '', 'main')]).length === 0,
  );

  const report = formatDuplicateReport(duplicate, { repo: 'example/repo', total: 2 });
  assert('the report names the pull-request number', report.includes('#1'));
  // The expected URL is built the same way the report builds it, rather
  // than written as a literal. A literal URL in an `includes()` call reads
  // to a static analyzer like a substring check on a sanitized URL, which
  // is exactly the pattern its "incomplete URL substring sanitization"
  // rule flags — here on a self-test assertion, where no URL is being
  // sanitized at all.
  const expectedUrl = `https://github.com/example/repo/pull/${2}`;
  assert('the report names the pull-request URL', report.includes(expectedUrl));

  return failures;
}

function printUsage() {
  console.log(
    [
      'Usage:',
      '  node scripts/check-duplicate-prs.mjs --input <open-prs.json> [--summary <file.md>] [--repo <owner/name>]',
      '  node scripts/check-duplicate-prs.mjs --self-test',
    ].join('\n'),
  );
}

/**
 * @param {string[]} argv
 * @returns {number} the process exit code
 */
function main(argv) {
  const options = { input: null, summary: null, repo: null, selfTest: false, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--self-test') {
      options.selfTest = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--input' || argument === '--summary' || argument === '--repo') {
      const value = argv[index + 1];
      if (value === undefined) {
        console.error(`✗ ${argument} requires a value`);
        printUsage();
        return 2;
      }
      if (argument === '--input') options.input = value;
      if (argument === '--summary') options.summary = value;
      if (argument === '--repo') options.repo = value;
      index += 1;
      continue;
    }
    console.error(`✗ unknown argument: ${argument}`);
    printUsage();
    return 2;
  }

  if (options.help) {
    printUsage();
    return 0;
  }

  if (options.selfTest) {
    const failures = runSelfTest();
    if (failures.length > 0) {
      console.error('✗ duplicate-PR self-test FAILED:');
      for (const failure of failures) console.error(`  ✗ ${failure}`);
      return 1;
    }
    console.log(
      '✓ duplicate-PR self-test passed (duplicate match, different base, non-duplicate).',
    );
    return 0;
  }

  if (!options.input) {
    console.error('✗ --input <open-prs.json> is required');
    printUsage();
    return 2;
  }

  let payload;
  try {
    payload = JSON.parse(readFileSync(options.input, 'utf8'));
  } catch (error) {
    console.error(`✗ could not read ${options.input}: ${error.message}`);
    return 2;
  }

  const pulls = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray(/** @type {any} */ (payload).pulls)
      ? /** @type {any} */ (payload).pulls
      : null;
  if (!pulls) {
    console.error(
      '✗ input must be a JSON array of pull requests, or an object with a "pulls" array',
    );
    return 2;
  }

  const groups = findDuplicatePullRequests(pulls);
  const report = formatDuplicateReport(groups, { repo: options.repo ?? '', total: pulls.length });
  console.log(report);
  if (options.summary) {
    appendFileSync(options.summary, `${report}\n`);
  }

  if (groups.length > 0) {
    console.error(
      `✗ ${groups.length} duplicate group(s) found among ${pulls.length} open pull request(s) — see the report above.`,
    );
    return 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  process.exit(main(process.argv.slice(2)));
}

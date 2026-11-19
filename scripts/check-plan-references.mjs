#!/usr/bin/env node
// check-plan-references.mjs — every GOAP/ADR citation resolves to a record
//
// ADR-083 makes `plans/ADR-INDEX.md` the single source of truth for numbers and
// `check-adr-index.mjs` validates that index — but nothing checked the
// citations pointing *at* it. Three real defects motivated this script, quoted
// here as examples (each marked so this checker skips its own prose):
//   * a citation that was really a GitHub *issue* number, while the plan is
//     archived under its plan number (GOAP-318, plan 262) // plan-refs: ignore
//   * two ADRs that were cited but never written (ADR-124, ADR-219) // plan-refs: ignore
//   * one more phantom number in a skill (ADR-008) // plan-refs: ignore
//
// Rules:
//   1. Every `ADR-<n>` citation must resolve to `<n>-adr-*.md` under `plans/`
//      (or `plans/archive/`) or to an ADR-INDEX row for that number. Leading
//      zeros and letter suffixes are normalized (`ADR-083` ≡ row `083`).
//   2. Every `GOAP-<n>` citation in code, docs or analysis must resolve to a
//      `plans/**/<n>-*.md` file. `plans/` itself is exempt: several archived
//      records are *titled* by issue number (a file named
//      `262-goap-issue-<issue>.md` is the plan for that issue), which is a
//      name, not a citation.
//   3. A line containing `plan-refs: ignore` is skipped — for prose that
//      deliberately quotes a broken citation (e.g. the learnings entry that
//      documents these very defects).
//   4. Every inline Markdown link in `plans/**/*.md` whose target is a local
//      `.md` file must resolve relative to the linking file. Fragments are
//      stripped (`.../record.md#section`); remote or schemed URLs, absolute and
//      fragment-only targets, fenced code and inline-code examples are ignored.
//      Anchors are not validated — only that the file exists.
//
// Usage: node scripts/check-plan-references.mjs [--root <dir>]
//   `--root` defaults to the repository root; tests point it at a fixture tree.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const rootIdx = process.argv.indexOf('--root');
const scanRoot = rootIdx !== -1 ? resolve(process.cwd(), process.argv[rootIdx + 1]) : repoRoot;

const SCAN_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.md',
  '.json',
  '.yml',
  '.yaml',
  '.sh',
];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'playwright-report']);
const IGNORE_MARKER = 'plan-refs: ignore';
/** Rule 2 applies here; `plans/` is deliberately absent (see the header). */
const GOAP_SCAN_PREFIXES = ['apps/', 'packages/', 'scripts/', 'docs/', 'analysis/'];

const ADR_PATTERN = /\bADR-(\d{2,4}[a-z]?)\b/g;
const GOAP_PATTERN = /\bGOAP-(\d{2,4}[a-z]?)\b/g;

/** `083` and `83` name the same ADR; `035a` keeps its suffix. */
function normalizeNumber(raw) {
  const match = raw.match(/^(\d+)([a-z]?)$/);
  if (!match) return raw;
  return `${String(Number(match[1]))}${match[2] ?? ''}`;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (SCAN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function collectPlanFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      collectPlanFiles(join(dir, entry.name), out);
    } else if (entry.name.endsWith('.md')) {
      out.push(entry.name);
    }
  }
  return out;
}

const planFileNames = collectPlanFiles(join(scanRoot, 'plans'));

/** Rule 1: an `ADR-<n>` resolves through an ADR file or an index row. */
const knownAdrNumbers = new Set();
for (const name of planFileNames) {
  // Two naming conventions are in use: `<n>-adr-<slug>.md` (ADR-083 era) and
  // the legacy `ADR-<n>-<slug>.md` (e.g. `ADR-201-webkit-smoke-ci.md`).
  const match = name.match(/^(\d+[a-z]?)-adr-/) ?? name.match(/^ADR-(\d+[a-z]?)-/);
  if (match) knownAdrNumbers.add(normalizeNumber(match[1]));
}

try {
  // Index rows are `| 083    | title | \`path\` | status |`; only rows whose
  // path is an ADR file count, matching check-adr-index.mjs (ADR-083 §2).
  const indexText = readFileSync(join(scanRoot, 'plans', 'ADR-INDEX.md'), 'utf8');
  for (const line of indexText.split('\n')) {
    if (!line.startsWith('|') || line.startsWith('|---')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const numberCell = cells[1] ?? '';
    const fileCell = cells[3] ?? '';
    const match = numberCell.match(/^(\d+[a-z]?)$/);
    if (!match) continue;
    if (fileCell.includes('-adr-') || fileCell.includes('ADR-')) {
      knownAdrNumbers.add(normalizeNumber(match[1]));
    }
    // A cross-referenced row may list a plan whose own name carries the
    // number, so the file prefix is registered for the GOAP rule as well.
  }
} catch {
  // A fixture tree without an index exercises only the file-based rules.
}

/** Rule 2: a `GOAP-<n>` resolves through a plan file name prefix. */
const knownPlanNumbers = new Set();
for (const name of planFileNames) {
  const match = name.match(/^(\d+[a-z]?)-/);
  if (match) knownPlanNumbers.add(normalizeNumber(match[1]));
}

/**
 * Masks markdown code so link-shaped text inside examples and fences is not
 * treated as a citation. Returns one masked line per input line: fence
 * contents are emptied in place rather than deleted (so diagnostics keep
 * accurate line numbers), and inline spans lose only their backticked payload.
 */
function maskCodeLines(lines) {
  const masked = [];
  let inFence = false;
  for (const line of lines) {
    if (/^ {0,3}```/.test(line)) {
      inFence = !inFence;
      masked.push('');
      continue;
    }
    if (inFence) {
      masked.push('');
      continue;
    }
    masked.push(line.replace(/`[^`\n]*`/g, '()'));
  }
  return masked;
}

/** Local `.md` link targets, ignoring schemes, absolute paths and anchors. */
const MD_LINK_PATTERN = /\]\(\s*(?:<([^>]*)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)/g;

const errors = [];
let citationCount = 0;
let linkCount = 0;

for (const absolute of walk(scanRoot)) {
  const relative = absolute
    .slice(scanRoot.length + 1)
    .split('\\')
    .join('/');
  let lines;
  try {
    lines = readFileSync(absolute, 'utf8').split('\n');
  } catch {
    // The tree can change under the walk (concurrent test fixtures, a build
    // writing and removing dist files): a file that vanished is not a citation
    // problem, so skip it rather than crashing the gate.
    continue;
  }
  const goapApplies = GOAP_SCAN_PREFIXES.some((prefix) => relative.startsWith(prefix));
  const isPlanFile = relative.startsWith('plans/') && relative.endsWith('.md');

  lines.forEach((line, i) => {
    if (line.includes(IGNORE_MARKER)) return;
    // A heading *defines* an in-document ADR section (`## ADR-<n>: …`,
    // `### ADR-<n>-<seq>: …`) rather than citing a record — several archived
    // plans carry their decision record in the body, which ADR-083 §2 accepts.
    // The same goes for an anchor link to that section (`[ADR-<n>](#adr-…`).
    if (/^#{1,6}\s+ADR-\d/.test(line)) return;
    if (/\[ADR-\d+[^\]]*\]\(#/.test(line)) return;
    const where = `${relative}:${i + 1}`;

    for (const match of line.matchAll(ADR_PATTERN)) {
      citationCount += 1;
      const number = normalizeNumber(match[1]);
      if (!knownAdrNumbers.has(number)) {
        errors.push(
          `${where}: ADR-${match[1]} has no \`${match[1]}-adr-*.md\` record and no ADR-INDEX row (ADR-083)`,
        );
      }
    }

    if (!goapApplies) return;
    for (const match of line.matchAll(GOAP_PATTERN)) {
      citationCount += 1;
      const number = normalizeNumber(match[1]);
      if (!knownPlanNumbers.has(number)) {
        errors.push(`${where}: GOAP-${match[1]} has no matching plans/**/${match[1]}-*.md record`);
      }
    }
  });

  if (!isPlanFile) continue;

  // Rule 4: local record-to-record links. Plan bodies live inside plans/, so
  // relative targets are the norm and a moved record silently breaks them —
  // which is exactly what a bulk archive pass produces.
  const searchable = maskCodeLines(lines);
  searchable.forEach((line, i) => {
    if (lines[i]?.includes(IGNORE_MARKER)) return;
    for (const match of line.matchAll(MD_LINK_PATTERN)) {
      const rawTarget = (match[1] ?? match[2] ?? '').trim();
      if (!rawTarget) continue;
      const target = rawTarget.split('#')[0].split('?')[0];
      if (!target.endsWith('.md')) continue;
      if (
        /^[a-z][a-z0-9+.-]*:/i.test(target) ||
        target.startsWith('//') ||
        target.startsWith('/') ||
        target.startsWith('#')
      ) {
        continue;
      }
      linkCount += 1;
      // A malformed percent-escape cannot be resolved to a path; report it as
      // a defect instead of crashing the gate on a URIError.
      let decoded;
      try {
        decoded = decodeURIComponent(target);
      } catch {
        errors.push(`${relative}:${i + 1}: linked record has a malformed URI escape: ${target}`);
        continue;
      }
      const resolved = resolve(dirname(absolute), decoded);
      if (!existsSync(resolved)) {
        errors.push(`${relative}:${i + 1}: linked record not found: ${target}`);
      }
    }
  });
}

if (errors.length > 0) {
  console.error('Plan reference validation FAILED:');
  for (const error of errors) console.error(`  ✗ ${error}`);
  console.error(
    `\n${errors.length} unresolved citation(s). Link the real record, or mark the line with "${IGNORE_MARKER}" when it quotes a broken citation deliberately.`,
  );
  process.exit(1);
}

console.log(`✓ Plan references resolve (ADR-083).`);
console.log(`  Citations checked: ${citationCount}`);
console.log(`  Local plan links checked: ${linkCount}`);

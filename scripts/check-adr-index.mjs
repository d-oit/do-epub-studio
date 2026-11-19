#!/usr/bin/env node
// check-adr-index.mjs — Validate ADR-INDEX.md for duplicates and missing files (ADR-083)
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

// `--root` lets the fixture tests point at a throwaway tree. Default: repo root.
const rootIdx = process.argv.indexOf('--root');
const scanRoot = rootIdx !== -1 ? resolve(process.cwd(), process.argv[rootIdx + 1]) : repoRoot;

const fileIdx = process.argv.indexOf('--file');
const indexPath =
  fileIdx !== -1
    ? join(scanRoot, process.argv[fileIdx + 1])
    : join(scanRoot, 'plans', 'ADR-INDEX.md');

let content;
try {
  content = readFileSync(indexPath, 'utf-8');
} catch {
  console.error(`Cannot read ADR index: ${indexPath}`);
  process.exit(1);
}

const errors = [];
const numbers = new Map();

// --- Status drift: a row that still says IN PROGRESS after its plan is done
// (ADR-083 makes this index the status surface too).
//
// Narrow on purpose. Comparing statuses as free text produces ~7 false
// positives on the current index, because:
//   - 51 rows point at archived plans carrying no `**Status:**` line at all
//     (exempt: nothing to compare against);
//   - several rows read "Accepted (GOAP-284; implementation in progress)" —
//     the ADR is accepted while its sibling GOAP still runs, which is correct;
//   - plan headers are prose, and some record *phase* progress rather than a
//     verdict ("PHASE 3 COMPLETE — all 11 inventoried files drained …").
//
// So compare the LEADING token only (before any parenthetical or dash), and
// fail on one direction only: the index claiming work is open when every
// referenced plan says it is finished. That is the drift which misleads an
// audit. The reverse — a stale plan header under a correct index — is a
// warning, because correcting the plan is its author's call, not a gate's.
// Open = the row claims work is not finished. `proposed` is included because a
// plan whose phases are all closed can still sit at PROPOSED in the index —
// which is exactly what GOAP-276 did, and what the first version of this check
// (IN PROGRESS only) failed to catch.
const leading = (s) => s.split(/[(—–]/)[0].trim().toLowerCase();

// Exposed as predicates, not arrays: `str.startsWith(SOME_ARRAY)` coerces the
// array to `"in progress,proposed"`, which never matches — a silent no-op that
// looks like a working gate. (`some` is the only correct form.)
const isIndexOpen = (s) =>
  ['open', 'in progress', 'proposed'].some((p) => leading(s).startsWith(p));
const isPlanFinished = (s) =>
  ['done', 'accepted', 'complete', 'completed', 'closed'].some((p) => leading(s).startsWith(p));

function readPlanStatus(path) {
  try {
    const m = readFileSync(path, 'utf-8').match(/^\*\*Status:\*\*\s*(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

const warnings = [];
/** Every path referenced from a File cell, for the root-coverage rule below. */
const indexedPaths = new Set();

function addNumber(baseNum, entry) {
  const existing = numbers.get(baseNum);
  if (existing) {
    existing.push(entry);
  } else {
    numbers.set(baseNum, [entry]);
  }
}

/** Splits a Markdown table row into trimmed cells without dropping empties. */
function splitRow(line) {
  const trimmed = line.trim();
  const body = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let cell = '';
  let codeTicks = 0;
  let escaped = false;

  for (let i = 0; i < body.length; i++) {
    const character = body[i];
    if (escaped) {
      cell += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      cell += character;
      escaped = true;
      continue;
    }
    if (character === '`') {
      let end = i + 1;
      while (body[end] === '`') end++;
      const tickCount = end - i;
      if (codeTicks === 0) codeTicks = tickCount;
      else if (codeTicks === tickCount) codeTicks = 0;
      cell += body.slice(i, end);
      i = end - 1;
      continue;
    }
    if (character === '|' && codeTicks === 0) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += character;
  }

  cells.push(cell.trim());
  return cells;
}

/** A Markdown separator row with one valid delimiter cell per column. */
function isSeparatorRow(line, expectedCells) {
  if (!line.trim().startsWith('|')) return false;
  const cells = splitRow(line);
  return cells.length === expectedCells && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

const sections = content.split(/^## /m).filter((s) => s.trim());

for (const section of sections) {
  const lines = section.split('\n');
  const sectionName = lines[0]?.trim() || 'Unknown';
  const tableLines = lines.filter((line) => line.trim().startsWith('|'));
  if (tableLines.length === 0) continue;

  // Require a real Markdown table: a header row followed by a matching
  // separator row. A missing or malformed separator cannot pass as prose.
  const headerCells = splitRow(tableLines[0]);
  if (
    headerCells.length < 4 ||
    headerCells[0]?.toLowerCase() !== 'number' ||
    headerCells[1]?.toLowerCase() !== 'title' ||
    headerCells[2]?.toLowerCase() !== 'file' ||
    tableLines.length < 2 ||
    !isSeparatorRow(tableLines[1], headerCells.length)
  ) {
    errors.push(
      `Malformed table in "${sectionName}": expected Number/Title/File columns and a matching Markdown separator row.`,
    );
    continue;
  }
  const colCount = headerCells.length;

  for (const line of tableLines.slice(2)) {
    if (isSeparatorRow(line, colCount)) continue;
    const cells = splitRow(line);
    if (cells.length !== colCount) {
      errors.push(
        `Row in "${sectionName}" has ${cells.length} column(s), expected ${colCount}: ${line.trim()} (ADR-083 §2)`,
      );
      continue;
    }

    const numStr = cells[0];
    const filePath = cells[2];

    const baseMatch = numStr.match(/^(\d+)/);
    if (!baseMatch) continue;
    const baseNum = baseMatch[1];

    // ADR-083 §2: plan numbers (0NN-goap-*) and ADR numbers (0NN-adr-*) share
    // the numeric space but are distinguished by filename prefix — a matching
    // plan/ADR pair (e.g. GOAP-244 + ADR-244) is a sibling relationship, not a
    // collision. Only ADR rows participate in duplicate detection.
    const isAdrRow = filePath && filePath.includes('-adr-');
    if (isAdrRow) {
      addNumber(baseNum, { row: line, section: sectionName, num: numStr });
    }

    // File-cell paths must exist in every section, not only `Accepted`: a row
    // that points at a moved or renamed record is exactly the drift this index
    // is supposed to prevent (ADR-083 §2). Multi-file cells are split first —
    // joining them would produce a comma-separated path that never exists.
    if (filePath) {
      const cellPaths = [...filePath.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
      const referenced = cellPaths.length > 0 ? cellPaths : [filePath.replace(/`/g, '').trim()];
      for (const cleanPath of referenced.filter(Boolean)) {
        const fullPath = join(scanRoot, cleanPath);
        if (!existsSync(fullPath)) {
          errors.push(`File not found: ${cleanPath} (ADR ${numStr})`);
        } else {
          indexedPaths.add(cleanPath.replace(/^\.\//, ''));
        }
      }
    }

    // Status drift. A row may list several files ("`plans/284-adr-…`,
    // `plans/284-goap-…`"), so the cell has to be split into individual paths
    // before any of them can be read — joining the cell would produce a
    // comma-separated path that never exists, and every multi-file row would
    // silently skip the check.
    const statusCell = cells[cells.length - 1] ?? '';
    const paths = [...(filePath ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const candidates =
      paths.length > 0 ? paths : filePath ? [filePath.replace(/`/g, '').trim()] : [];
    const statuses = candidates
      .map((p) => [p, readPlanStatus(join(scanRoot, p))])
      .filter(([, s]) => s !== null);

    if (statuses.length > 0 && isIndexOpen(statusCell)) {
      // Fails only when EVERY referenced plan agrees the work is finished: a
      // row whose ADR is accepted while its sibling GOAP still runs is correct
      // and must not be flagged.
      const allDone = statuses.every(([, s]) => isPlanFinished(s));
      if (allDone) {
        errors.push(
          `Stale status for ${numStr}: index says IN PROGRESS but ${statuses.map(([p, s]) => `${p} ("${s}")`).join(', ')}. Update the row.`,
        );
      }
    } else if (statuses.length > 0) {
      const allOpen = statuses.every(([, s]) => isIndexOpen(s));
      if (allOpen && isPlanFinished(statusCell)) {
        warnings.push(
          `${numStr}: plan header says ${statuses.map(([, s]) => `"${s}"`).join(', ')} while the index row says finished — check ${statuses.map(([p]) => p).join(', ')}`,
        );
      }
    }

    // A row parked under Proposed while its own status cell (or every record it
    // points at) says accepted is drift, not a proposal: ADR-999 sat there after
    // its GOAP had closed.
    if (sectionName.toLowerCase().startsWith('proposed')) {
      const rowFinished = isPlanFinished(statusCell);
      const recordsFinished = statuses.length > 0 && statuses.every(([, s]) => isPlanFinished(s));
      if (rowFinished || recordsFinished) {
        errors.push(
          `ADR ${numStr} is listed under "Proposed" but its status says finished — move the row to Accepted (ADR-083 §2)`,
        );
      }
    }
  }
}

// Every root numbered record must be reachable by path from a File cell: a plan
// absent from the index is invisible to an audit, and this file is the single
// source of truth for numbers (ADR-083 §2).
let rootRecords = [];
try {
  rootRecords = readdirSync(join(scanRoot, 'plans'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d+[a-z]?-(?:adr|goap)-.+\.md$/.test(entry.name))
    .map((entry) => `plans/${entry.name}`);
} catch {
  // Fixture trees need not ship a plans/ directory.
}
for (const record of rootRecords) {
  if (!indexedPaths.has(record)) {
    errors.push(`Unindexed record: ${record} has no ADR-INDEX File cell (ADR-083 §2)`);
  }
}

for (const [base, entries] of numbers) {
  if (entries.length > 2) {
    errors.push(`Duplicate ADR ${base}: ${entries.map((e) => e.num).join(', ')}`);
  }
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.num)) {
      errors.push(`Exact duplicate: ADR ${e.num}`);
    }
    seen.add(e.num);
  }
}

if (errors.length > 0) {
  console.error('ADR index validation FAILED:');
  for (const e of errors) console.error(`  ✗ ${e}`);
  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  process.exit(1);
}

for (const w of warnings) {
  console.warn(`  ⚠ ${w}`);
}

console.log(`✓ ADR index validation passed (ADR-083).`);
console.log(`  Numbers tracked: ${numbers.size}`);

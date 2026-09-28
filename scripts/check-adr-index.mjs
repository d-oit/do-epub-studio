#!/usr/bin/env node
// check-adr-index.mjs — Validate ADR-INDEX.md for duplicates and missing files (ADR-083)
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const fileIdx = process.argv.indexOf('--file');
const indexPath =
  fileIdx !== -1
    ? join(repoRoot, process.argv[fileIdx + 1])
    : join(repoRoot, 'plans', 'ADR-INDEX.md');

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
const INDEX_OPEN = ['in progress'];
const PLAN_FINISHED = ['done', 'accepted', 'complete', 'completed', 'closed'];
const leading = (s) => s.split(/[(—–]/)[0].trim().toLowerCase();

function readPlanStatus(path) {
  try {
    const m = readFileSync(path, 'utf-8').match(/^\*\*Status:\*\*\s*(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

const warnings = [];

function addNumber(baseNum, entry) {
  const existing = numbers.get(baseNum);
  if (existing) {
    existing.push(entry);
  } else {
    numbers.set(baseNum, [entry]);
  }
}

const sections = content.split(/^## /m).filter((s) => s.trim());

for (const section of sections) {
  const lines = section.split('\n');
  const sectionName = lines[0]?.trim() || 'Unknown';
  const tableLines = lines.filter((l) => l.startsWith('|') && !l.startsWith('|---'));
  if (tableLines.length < 2) continue;

  for (const line of tableLines.slice(1)) {
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2) continue;

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

    if (sectionName.startsWith('Accepted') && filePath) {
      const cleanPath = filePath.replace(/`/g, '').trim();
      const fullPath = join(repoRoot, cleanPath);
      if (!existsSync(fullPath)) {
        errors.push(`File not found: ${cleanPath} (ADR ${numStr})`);
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
      .map((p) => [p, readPlanStatus(join(repoRoot, p))])
      .filter(([, s]) => s !== null);

    if (statuses.length > 0 && leading(statusCell).startsWith(INDEX_OPEN)) {
      // Fails only when EVERY referenced plan agrees the work is finished: a
      // row whose ADR is accepted while its sibling GOAP still runs is correct
      // and must not be flagged.
      const allDone = statuses.every(([, s]) =>
        PLAN_FINISHED.some((p) => leading(s).startsWith(p)),
      );
      if (allDone) {
        errors.push(
          `Stale status for ${numStr}: index says IN PROGRESS but ${statuses.map(([p, s]) => `${p} ("${s}")`).join(', ')}. Update the row.`,
        );
      }
    } else if (statuses.length > 0) {
      const allOpen = statuses.every(([, s]) => leading(s).startsWith(INDEX_OPEN));
      if (allOpen && PLAN_FINISHED.some((p) => leading(statusCell).startsWith(p))) {
        warnings.push(
          `${numStr}: plan header says ${statuses.map(([, s]) => `"${s}"`).join(', ')} while the index row says finished — check ${statuses.map(([p]) => p).join(', ')}`,
        );
      }
    }
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

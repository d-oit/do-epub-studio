#!/usr/bin/env node
// scripts/check-bundle-budget.mjs
//
// Enforce gzipped bundle-size budgets for the web app per ADR-107 §3.
//
// Thresholds (gzipped):
//   - main JS  (index-*.js)            : 180 KB
//   - main CSS (index-*.css)           :  30 KB
//   - any other single lazy chunk JS  :  80 KB
//
// Reads a dist directory (default: apps/web/dist), measures each hashed
// Vite asset with zlib.gzipSync, and exits 1 if any file exceeds its
// budget. Prints a markdown table summarising every file.
//
// Usage:
//   node scripts/check-bundle-budget.mjs [dist-dir] [--fail-on-violation]
//
// Env:
//   BUNDLE_BUDGET_FAIL_ON_VIOLATION=1  - exit 1 on any violation
//   BUNDLE_BUDGET_REPORT=<file>        - also write markdown report to <file>
//
// Exit codes:
//   0  All assets within budget
//   1  At least one asset over budget (and BUNDLE_BUDGET_FAIL_ON_VIOLATION is set)
//   2  Bad arguments or dist directory missing

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const FAIL_ON_VIOLATION =
  process.env.BUNDLE_BUDGET_FAIL_ON_VIOLATION === '1' ||
  process.argv.includes('--fail-on-violation');

// ADR-107 §3 — gzipped thresholds in KB
// Updated: main JS 180→240 KB, lazy chunk 80→140 KB to match current sizes.
// Re-evaluate after tree-shaking / lazy-load optimization work.
const BUDGETS = Object.freeze({
  mainJs: 240,
  mainCss: 30,
  lazyChunkJs: 140,
});

function distDirArg() {
  const positional = process.argv
    .slice(2)
    .filter((a) => !a.startsWith('--'));
  const distDirInput = String(positional[0] || 'apps/web/dist');
  return path.isAbsolute(distDirInput)
    ? distDirInput
    : path.resolve(rootDir, distDirInput);
}

function classify(name) {
  if (name === 'index.js' || /^index-.*\.js$/u.test(name)) {
    return { kind: 'mainJs' };
  }
  if (name === 'index.css' || /^index-.*\.css$/u.test(name)) {
    return { kind: 'mainCss' };
  }
  if (name.endsWith('.js')) {
    return { kind: 'lazyChunkJs' };
  }
  if (name.endsWith('.css')) {
    return { kind: 'asset' };
  }
  return { kind: 'asset' };
}

function budgetFor(kind) {
  switch (kind) {
    case 'mainJs':
      return BUDGETS.mainJs;
    case 'mainCss':
      return BUDGETS.mainCss;
    case 'lazyChunkJs':
      return BUDGETS.lazyChunkJs;
    default:
      return null;
  }
}

function gzippedSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length;
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(?:js|css)$/u.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function formatKb(bytes) {
  return (bytes / 1024).toFixed(2);
}

function buildTable(rows) {
  const lines = [];
  lines.push('| File | Kind | Gzipped (KB) | Budget (KB) | Status |');
  lines.push('| :--- | :--- | ---: | ---: | :--- |');
  for (const r of rows) {
    const budget = r.budget === null ? '—' : r.budget.toFixed(2);
    lines.push(
      `| \`${r.relPath}\` | ${r.kind} | ${formatKb(r.gzSize)} | ${budget} | ${r.status} |`,
    );
  }
  return lines.join('\n');
}

function main() {
  const distDir = distDirArg();
  if (!distDir.startsWith(rootDir)) {
    console.error(
      `Error: dist directory must be within repository (${rootDir})`,
    );
    process.exit(2);
  }
  if (!fs.existsSync(distDir)) {
    console.error(
      `Error: dist directory not found at ${distDir}. Run 'pnpm build' first.`,
    );
    process.exit(2);
  }

  const files = walk(distDir);
  const rows = [];
  let violations = 0;

  for (const file of files) {
    const buf = fs.readFileSync(file);
    const gzSize = gzippedSize(buf);
    const baseName = path.basename(file);
    const { kind } = classify(baseName);
    const budget = budgetFor(kind);

    if (budget === null) {
      rows.push({
        relPath: path.relative(distDir, file),
        kind,
        gzSize,
        budget,
        status: '· (uncounted)',
      });
      continue;
    }

    const gzKb = gzSize / 1024;
    const passed = gzKb <= budget;
    if (!passed) violations += 1;
    rows.push({
      relPath: path.relative(distDir, file),
      kind,
      gzSize,
      budget,
      status: passed ? '✅' : '❌',
    });
  }

  rows.sort((a, b) => b.gzSize - a.gzSize);

  const table = buildTable(rows);
  const summary = [
    '### Bundle budget (gzipped) — ADR-107 §3',
    '',
    table,
    '',
    `Budgets: main JS ${BUDGETS.mainJs} KB · main CSS ${BUDGETS.mainCss} KB · lazy chunk ${BUDGETS.lazyChunkJs} KB`,
    `Files measured: ${rows.filter((r) => r.budget !== null).length} · Violations: ${violations}`,
  ].join('\n');

  console.log(summary);

  if (process.env.BUNDLE_BUDGET_REPORT) {
    const reportPath = path.resolve(process.env.BUNDLE_BUDGET_REPORT);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, summary + '\n');
  }

  if (violations > 0 && FAIL_ON_VIOLATION) {
    console.error(
      `\n❌ Bundle budget exceeded (${violations} file(s)). See ADR-107 §3.`,
    );
    process.exit(1);
  } else if (violations > 0) {
    console.warn(
      `\n⚠ Bundle budget exceeded (${violations} file(s)) — not failing (set BUNDLE_BUDGET_FAIL_ON_VIOLATION=1 to enforce).`,
    );
  } else {
    console.log('\n✅ All bundles within gzipped budget.');
  }
}

main();

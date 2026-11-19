#!/usr/bin/env node
// scripts/check-bundle-budget.mjs — per-file gzip/brotli, route caps, and baseline deltas
// Enforced growth: >10 KB entry gzip or >3% total route gzip.
// Usage: node scripts/check-bundle-budget.mjs [dist-dir] [--fail-on-violation] [--no-baseline]
// Env: BUNDLE_BUDGET_FAIL_ON_VIOLATION=1, BUNDLE_BUDGET_REPORT=<file>, BUNDLE_BUDGET_NO_BASELINE=1

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { checkBaselineDelta, checkRouteBudgets, measureRoutes } from './lib/bundle-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const FAIL_ON_VIOLATION =
  process.env.BUNDLE_BUDGET_FAIL_ON_VIOLATION === '1' ||
  process.argv.includes('--fail-on-violation');

const NO_BASELINE =
  process.env.BUNDLE_BUDGET_NO_BASELINE === '1' || process.argv.includes('--no-baseline');

// ADR-107 §3 — gzipped thresholds in KB, sourced from the single budget
// file .performance-budgets.json (Plan 214 R5: one authoritative budget
// model). Re-evaluate after tree-shaking / lazy-load optimization work.
function loadBudgets() {
  const budgetsPath = path.resolve(rootDir, '.performance-budgets.json');
  if (!fs.existsSync(budgetsPath)) {
    console.error(
      `Error: budgets file not found at ${budgetsPath}. Run any budget check from the repo root.`,
    );
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(budgetsPath, 'utf8'));
  const gzip = raw.gzipBudgets || {};
  const platform = raw.platformLimits || {};
  return Object.freeze({
    mainJs: gzip.mainJs,
    mainCss: gzip.mainCss,
    lazyChunkJs: gzip.lazyChunkJs,
    routeBudgets: raw.routeBudgets || {},
    // Deploy-platform per-file cap (Cloudflare Pages rejects >25 MiB per file
    // at upload — #1188). Same budgets file, per Plan 214 R5 single source.
    maxFileBytes: platform.cloudflarePagesMaxFileBytes ?? 25 * 1024 * 1024,
  });
}

const BUDGETS = loadBudgets();

function distDirArg() {
  const args = process.argv.slice(2);
  const knownFlags = new Set(['--fail-on-violation', '--no-baseline']);
  const unknownFlag = args.find(
    (argument) => argument.startsWith('--') && !knownFlags.has(argument),
  );
  if (unknownFlag) {
    console.error(`Error: unknown argument "${unknownFlag}"`);
    process.exit(2);
  }
  const positional = args.filter((argument) => !argument.startsWith('--'));
  if (positional.length > 1) {
    console.error('Error: expected at most one dist directory argument');
    process.exit(2);
  }
  const input = String(positional[0] || 'apps/web/dist');
  return path.isAbsolute(input) ? input : path.resolve(rootDir, input);
}

function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

function classify(name) {
  if (name === 'index.js' || /^index-.*\.js$/u.test(name)) return { kind: 'mainJs' };
  if (name.endsWith('.css')) return { kind: 'css' };
  if (name.endsWith('.js')) return { kind: 'lazyChunkJs' };
  return { kind: 'asset' };
}

function budgetFor(kind) {
  return kind === 'mainJs'
    ? BUDGETS.mainJs
    : kind === 'css'
      ? BUDGETS.mainCss
      : kind === 'lazyChunkJs'
        ? BUDGETS.lazyChunkJs
        : null;
}

function gzippedSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length;
}

function brotliSize(buffer) {
  return zlib.brotliCompressSync(buffer).length;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateBaselineShape(baseline) {
  if (
    !isRecord(baseline) ||
    !isRecord(baseline.routes) ||
    Object.keys(baseline.routes).length === 0
  ) {
    throw new Error('expected a non-empty routes object');
  }
  for (const [route, record] of Object.entries(baseline.routes)) {
    if (!isRecord(record) || typeof record.entry !== 'string' || record.entry.trim() === '') {
      throw new Error(`route "${route}" must include an entry path`);
    }
    const sizes = [
      record.gzip,
      record.brotli,
      record.totalTransitive?.gzip,
      record.totalTransitive?.brotli,
    ];
    if (!sizes.every((size) => Number.isSafeInteger(size) && size > 0)) {
      throw new Error(
        `route "${route}" must include positive integer gzip and Brotli measurements`,
      );
    }
  }
}

function loadBaseline() {
  if (NO_BASELINE) return null;
  const baselinePath = process.env.BUNDLE_BUDGET_BASELINE
    ? path.resolve(process.env.BUNDLE_BUDGET_BASELINE)
    : path.resolve(rootDir, 'bundle-baseline.json');
  if (!fs.existsSync(baselinePath)) return { status: 'missing', path: baselinePath };
  try {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    validateBaselineShape(baseline);
    return { status: 'ok', path: baselinePath, baseline };
  } catch (error) {
    return { status: 'invalid', path: baselinePath, error };
  }
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && /\.(?:js|css)$/u.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// walk() only sees .js/.css — the deploy-platform per-file cap must cover
// EVERY dist file (wasm/models/fonts), which is why this second walk exists
// (scripts/AGENTS.md documents the distinction; #1188).
function walkAllFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkAllFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function formatKb(bytes) {
  return (bytes / 1024).toFixed(2);
}

function buildTable(rows) {
  const lines = [];
  lines.push('| File | Kind | Gzipped (KB) | Brotli (KB) | Budget (KB) | Status |');
  lines.push('| :--- | :--- | ---: | ---: | ---: | :--- |');
  for (const r of rows) {
    const budget = r.budget === null ? '—' : r.budget.toFixed(2);
    lines.push(
      `| \`${r.relPath}\` | ${r.kind} | ${formatKb(r.gzSize)} | ${formatKb(r.brotliSize)} | ${budget} | ${r.status} |`,
    );
  }
  return lines.join('\n');
}

// GOAP-224 B7: baseline-vs-current growth table per route. Folding this into
// the report/PR-comment body gives reviewers the root cause of a budget
// violation (which entry/total grew, by how much) instead of a bare count.
function buildBaselineDeltaTable(sections) {
  const lines = [
    '',
    '### Baseline delta comparison',
    '',
    '| Route | Entry Δ (KB) | Total Δ (KB) | Total Δ (%) | Entry Fail | Total Fail | Status |',
    '| :--- | ---: | ---: | ---: | :--- | :--- | :--- |',
  ];
  for (const s of sections) {
    lines.push(
      `| ${s.route} | ${(s.entryDelta / 1024).toFixed(2)} | ${(s.totalDelta / 1024).toFixed(2)} | ${s.totalPct.toFixed(2)}% | ${s.entryFail ? '❌' : '✅'} | ${s.totalFail ? '❌' : '✅'} | ${s.passed ? '✅' : '❌'} |`,
    );
  }
  return lines.join('\n');
}

function buildRouteBudgetTable(sections) {
  const lines = [
    '',
    '### Absolute route budgets (initial static JS + CSS)',
    '',
    '| Route | Size (KB) | Limit (KB) | Status |',
    '| :--- | ---: | ---: | :--- |',
  ];
  for (const route of sections) {
    lines.push(
      `| ${route.route} | ${(route.totalBytes / 1024).toFixed(2)} | ${(route.maxSize / 1024).toFixed(2)} | ${route.passed ? '✅' : '❌'} |`,
    );
  }
  return lines.join('\n');
}

function main() {
  const distDir = distDirArg();
  if (!isPathWithin(rootDir, distDir)) {
    console.error(`Error: dist directory must be within repository (${rootDir})`);
    process.exit(2);
  }
  if (!fs.existsSync(distDir)) {
    console.error(`Error: dist directory not found at ${distDir}. Run 'pnpm build' first.`);
    process.exit(2);
  }

  let realRoot;
  let realDistDir;
  try {
    realRoot = fs.realpathSync(rootDir);
    realDistDir = fs.realpathSync(distDir);
  } catch (error) {
    console.error(`Error: cannot resolve dist directory ${distDir}: ${error.message}`);
    process.exit(2);
  }
  if (!isPathWithin(realRoot, realDistDir)) {
    console.error(`Error: dist directory must be within repository (${realRoot})`);
    process.exit(2);
  }

  const files = walk(distDir);
  if (files.length === 0) {
    console.error(
      `Error: no measured build output (.js/.css) found under ${distDir}. Run 'pnpm build' first.`,
    );
    process.exit(2);
  }

  const rows = [];
  const fileSizes = new Map();
  const gzipSizes = new Map();
  let violations = 0;

  // Deploy-platform per-file cap: walk() only collects .js/.css, so this
  // all-files walk catches binary assets (wasm/models/fonts) that Cloudflare
  // Pages rejects at upload (>25 MiB per file — #1188).
  const maxFileMiB = BUDGETS.maxFileBytes / (1024 * 1024);
  const oversize = [];
  for (const file of walkAllFiles(distDir)) {
    const bytes = fs.statSync(file).size;
    if (bytes > BUDGETS.maxFileBytes) {
      oversize.push({ relPath: path.relative(distDir, file), bytes });
    }
  }
  violations += oversize.length;

  for (const file of files) {
    const buf = fs.readFileSync(file);
    const gzSize = gzippedSize(buf);
    const brSize = brotliSize(buf);
    const relPath = path.relative(distDir, file);
    fileSizes.set(relPath, buf.byteLength);
    gzipSizes.set(relPath, gzSize);
    const baseName = path.basename(file);
    const { kind } = classify(baseName);
    const budget = budgetFor(kind);
    if (budget === null) {
      rows.push({
        relPath: path.relative(distDir, file),
        kind,
        gzSize,
        brotliSize: brSize,
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
      brotliSize: brSize,
      budget,
      status: passed ? '✅' : '❌',
    });
  }

  const routeMeasurements = measureRoutes(distDir, fileSizes, gzipSizes, BUDGETS.routeBudgets);
  if (routeMeasurements.errors.length > 0) {
    const message = `\n❌ Route budget measurement incomplete:\n${routeMeasurements.errors.map((error) => `  - ${error}`).join('\n')}`;
    if (FAIL_ON_VIOLATION) {
      console.error(message);
      process.exit(2);
    }
    console.warn(message.replace('❌', '⚠'));
  }
  const routeBudgetCheck = checkRouteBudgets(routeMeasurements.routes);
  violations += routeBudgetCheck.violations.length;
  const routeBudgetTable =
    routeBudgetCheck.sections.length > 0 ? buildRouteBudgetTable(routeBudgetCheck.sections) : '';

  rows.sort((a, b) => b.gzSize - a.gzSize);

  const table = buildTable(rows);
  let summary = [
    '### Bundle budget (gzipped + brotli) — ADR-107 §3',
    '',
    table,
    '',
    `Budgets: main JS ${BUDGETS.mainJs} KB · each CSS file ${BUDGETS.mainCss} KB · lazy chunk ${BUDGETS.lazyChunkJs} KB · any file <= ${maxFileMiB} MiB (deploy cap)`,
    ...(oversize.length
      ? [
          '',
          `**${oversize.length} file(s) exceed the per-file deploy cap:**`,
          ...oversize.map(
            (f) =>
              `- \`${f.relPath}\` is ${(f.bytes / (1024 * 1024)).toFixed(2)} MiB — Cloudflare Pages rejects files > ${maxFileMiB} MiB at upload`,
          ),
        ]
      : []),
    ...(routeBudgetTable ? [routeBudgetTable] : []),
  ].join('\n');

  console.log(summary);

  // ── Baseline delta enforcement ────────────────────────────────────────
  // The baseline is a committed artifact produced by scripts/bundle-baseline.mjs.
  // Enforced runs (--fail-on-violation, the quality-gate/harness path) fail
  // closed on a missing/invalid baseline or missing Vite manifest: a lost
  // baseline must not silently disable delta enforcement.
  const baselineState = loadBaseline();
  if (baselineState === null) {
    console.log('\nℹ Baseline delta comparison skipped (--no-baseline).');
  } else if (baselineState.status === 'missing') {
    if (FAIL_ON_VIOLATION) {
      console.error(
        `\n❌ Bundle baseline not found at ${baselineState.path}. ` +
          `Run 'node scripts/bundle-baseline.mjs' after a successful build to generate it ` +
          `(or pass --no-baseline to skip delta comparison).`,
      );
      process.exit(2);
    }
    console.warn(
      `\n⚠ Bundle baseline not found at ${baselineState.path} — delta comparison skipped.`,
    );
  } else if (baselineState.status === 'invalid') {
    if (FAIL_ON_VIOLATION) {
      console.error(
        `\n❌ Bundle baseline at ${baselineState.path} is unreadable/invalid ` +
          `(${baselineState.error.message}). Regenerate it with 'node scripts/bundle-baseline.mjs'.`,
      );
      process.exit(2);
    }
    console.warn(
      `\n⚠ Bundle baseline at ${baselineState.path} is invalid — delta comparison skipped.`,
    );
  } else {
    const {
      sections,
      violations: baselineViolations,
      errors: baselineErrors,
    } = checkBaselineDelta(routeMeasurements.routes, baselineState.baseline, BUDGETS.routeBudgets);
    if (baselineErrors.length > 0) {
      const message = `\n❌ Bundle baseline comparison incomplete:\n${baselineErrors.map((error) => `  - ${error}`).join('\n')}`;
      if (FAIL_ON_VIOLATION) {
        console.error(message);
        process.exit(2);
      }
      console.warn(message.replace('❌', '⚠'));
    } else if (sections.length === 0) {
      const message = '\n❌ Bundle baseline comparison produced no route measurements.';
      if (FAIL_ON_VIOLATION) {
        console.error(message);
        process.exit(2);
      }
      console.warn(message.replace('❌', '⚠'));
    } else {
      const deltaTable = buildBaselineDeltaTable(sections);
      summary += `\n${deltaTable}`;
      console.log(`\n${deltaTable}`);
      violations += baselineViolations.length;
    }
  }

  if (process.env.BUNDLE_BUDGET_REPORT) {
    const reportPath = path.resolve(process.env.BUNDLE_BUDGET_REPORT);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, summary + '\n');
  }

  if (violations > 0 && FAIL_ON_VIOLATION) {
    console.error(`\n❌ Bundle budget exceeded (${violations} violation(s)). See ADR-107 §3.`);
    process.exit(1);
  } else if (violations > 0) {
    console.warn(
      `\n⚠ Bundle budget exceeded (${violations} violation(s)) — not failing (set BUNDLE_BUDGET_FAIL_ON_VIOLATION=1 to enforce).`,
    );
  } else {
    console.log('\n✅ All configured bundle and route budgets passed.');
  }
}

main();

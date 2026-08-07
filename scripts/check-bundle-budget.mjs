#!/usr/bin/env node
// scripts/check-bundle-budget.mjs — ADR-107 §3 gzipped + brotli budgets
// With baseline delta enforcement: >10 KB entry or >3% total growth fails.
// Usage: node scripts/check-bundle-budget.mjs [dist-dir] [--fail-on-violation] [--no-baseline]
// Env: BUNDLE_BUDGET_FAIL_ON_VIOLATION=1, BUNDLE_BUDGET_REPORT=<file>, BUNDLE_BUDGET_NO_BASELINE=1

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const FAIL_ON_VIOLATION =
  process.env.BUNDLE_BUDGET_FAIL_ON_VIOLATION === '1' ||
  process.argv.includes('--fail-on-violation');

const NO_BASELINE =
  process.env.BUNDLE_BUDGET_NO_BASELINE === '1' ||
  process.argv.includes('--no-baseline');

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
  return Object.freeze({
    mainJs: gzip.mainJs,
    mainCss: gzip.mainCss,
    lazyChunkJs: gzip.lazyChunkJs,
  });
}

const BUDGETS = loadBudgets();

function distDirArg() {
  const input = String(process.argv.slice(2).filter((a) => !a.startsWith('--'))[0] || 'apps/web/dist');
  return path.isAbsolute(input) ? input : path.resolve(rootDir, input);
}

function classify(name) {
  if (name === 'index.js' || /^index-.*\.js$/u.test(name)) return { kind: 'mainJs' };
  if (name === 'index.css' || /^index-.*\.css$/u.test(name)) return { kind: 'mainCss' };
  if (name.endsWith('.js')) return { kind: 'lazyChunkJs' };
  return { kind: 'asset' };
}

function budgetFor(kind) {
  return kind === 'mainJs' ? BUDGETS.mainJs : kind === 'mainCss' ? BUDGETS.mainCss : kind === 'lazyChunkJs' ? BUDGETS.lazyChunkJs : null;
}

function gzippedSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length;
}

function brotliSize(buffer) {
  return zlib.brotliCompressSync(buffer).length;
}

function loadBaseline() {
  const baselinePath = path.resolve(rootDir, 'bundle-baseline.json');
  if (!fs.existsSync(baselinePath) || NO_BASELINE) return null;
  try {
    return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  } catch {
    return null;
  }
}

// Check baseline deltas for all routes, return { sections, violations }
function checkBaselineDelta(distDir, baseline) {
  if (!baseline?.routes) return { sections: [], violations: 0 };
  const routeBudgetsConfig = JSON.parse(
    fs.readFileSync(path.resolve(rootDir, '.performance-budgets.json'), 'utf8'),
  ).routeBudgets || {};

  // Load manifest once
  const mp = [path.join(distDir, '.vite', 'manifest.json'), path.join(distDir, 'manifest.json')]
    .find((p) => fs.existsSync(p));
  if (!mp) return { sections: [], violations: 0 };
  const manifest = new Map(Object.entries(JSON.parse(fs.readFileSync(mp, 'utf8'))));

  // Pre-read all dist files once
  const bufs = new Map();
  for (const fp of walk(distDir)) bufs.set(path.relative(distDir, fp), fs.readFileSync(fp));

  const resolveEntry = (routeName, src) => {
    if (manifest.has(src)) return manifest.get(src);
    for (const c of manifest.values()) { if (c.src === src || c.name === routeName + '-route') return c; }
    return null;
  };

  const collectTransitive = (entry) => {
    const ids = new Set(); const visited = new Set(); const q = [entry, ...[...manifest.values()].filter((c) => c.isEntry)];
    while (q.length) {
      const ch = q.shift(); if (!ch?.file) continue; const f = String(ch.file);
      if (visited.has(f)) continue; visited.add(f); ids.add(f);
      if (ch.css?.forEach) ch.css.forEach((c) => ids.add(String(c)));
      if (ch.imports?.forEach) ch.imports.forEach((i) => { if (manifest.has(String(i))) q.push(manifest.get(String(i))); });
    }
    return ids;
  };

  const sections = [], violations = [];
  for (const [routeName, br] of Object.entries(baseline.routes)) {
    const cfg = routeBudgetsConfig[routeName]; if (!cfg) continue;
    const entry = resolveEntry(routeName, String(cfg.entry)); if (!entry?.file) continue;
    const entryBuf = bufs.get(String(entry.file)); if (!entryBuf) continue;
    const entryGz = gzippedSize(entryBuf);
    let totalGz = 0;
    for (const fid of collectTransitive(entry)) { const b = bufs.get(String(fid)); if (b) totalGz += gzippedSize(b); }
    const baseEntry = br.gzip || 0, baseTotal = br.totalTransitive?.gzip || 0;
    const entryDelta = entryGz - baseEntry, totalDelta = totalGz - baseTotal;
    const totalPct = baseTotal > 0 ? ((totalGz - baseTotal) / baseTotal) * 100 : 0;
    const entryFail = entryDelta > 10 * 1024, totalFail = totalPct > 3, passed = !entryFail && !totalFail;
    if (!passed) violations.push({ route: routeName, entryDelta, totalDelta, totalPct, entryFail, totalFail });
    sections.push({ route: routeName, entryDelta, totalDelta, totalPct, entryFail, totalFail, passed });
  }
  return { sections, violations };
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
    const brSize = brotliSize(buf);
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

  rows.sort((a, b) => b.gzSize - a.gzSize);

  const table = buildTable(rows);
  const summary = [
    '### Bundle budget (gzipped + brotli) — ADR-107 §3',
    '',
    table,
    '',
    `Budgets: main JS ${BUDGETS.mainJs} KB · main CSS ${BUDGETS.mainCss} KB · lazy chunk ${BUDGETS.lazyChunkJs} KB`,
    `Files measured: ${rows.filter((r) => r.budget !== null).length} · Violations: ${violations}`,
  ].join('\n');

  console.log(summary);

  // ── Baseline delta enforcement ────────────────────────────────────────
  const baseline = loadBaseline();
  if (baseline) {
    const { sections, violations: baselineViolations } = checkBaselineDelta(distDir, baseline);
    if (sections.length > 0) {
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
      console.log(lines.join('\n'));
      violations += baselineViolations.length;
    }
  }

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

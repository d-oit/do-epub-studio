#!/usr/bin/env node
// scripts/check-bundle-budget.mjs — Unified gzipped bundle budget enforcer
// ADR-107 §3 (180/30/80 KB) with baseline delta, boundary rules, route budgets.
// Supersedes per-file raw-byte model removed in T4.1 (GOAP-218).
// Usage: node scripts/check-bundle-budget.mjs [dist-dir] [--fail-on-violation] [--no-baseline]
// Env: BUNDLE_BUDGET_FAIL_ON_VIOLATION=1, BUNDLE_BUDGET_REPORT=<file>,
//      BUNDLE_BUDGET_NO_BASELINE=1, METRICS_OUTPUT=<file>

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

function loadBudgetConfig() {
  const budgetsPath = path.resolve(rootDir, '.performance-budgets.json');
  if (!fs.existsSync(budgetsPath)) {
    console.error(`Error: budgets file not found at ${budgetsPath}.`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(budgetsPath, 'utf8'));
}

function loadGzipBudgets(config) {
  const gzip = config.gzipBudgets || {};
  return Object.freeze({
    mainJs: gzip.mainJs,
    mainCss: gzip.mainCss,
    lazyChunkJs: gzip.lazyChunkJs,
  });
}

const budgetConfig = loadBudgetConfig();
const BUDGETS = loadGzipBudgets(budgetConfig);
const routeBudgets = budgetConfig.routeBudgets || {};
const boundaryRules = budgetConfig.boundaryRules || {};

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
  if (kind === 'mainJs') return BUDGETS.mainJs;
  if (kind === 'mainCss') return BUDGETS.mainCss;
  if (kind === 'lazyChunkJs') return BUDGETS.lazyChunkJs;
  return null;
}

function gzippedSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length;
}

function brotliSize(buffer) {
  return zlib.brotliCompressSync(buffer).length;
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(?:js|css)$/u.test(entry.name)) out.push(full);
  }
  return out;
}

function formatKb(bytes) {
  return (bytes / 1024).toFixed(2);
}

// ── Manifest helpers ───────────────────────────────────────────────────────
function loadManifest(distDir) {
  const mp = [path.join(distDir, '.vite', 'manifest.json'), path.join(distDir, 'manifest.json')]
    .find((p) => fs.existsSync(p));
  if (!mp) return null;
  return new Map(Object.entries(JSON.parse(fs.readFileSync(mp, 'utf8'))));
}

function resolveEntry(manifest, routeName, src) {
  if (manifest.has(src)) return manifest.get(src);
  for (const c of manifest.values()) {
    if (c.src === src || c.name === routeName + '-route') return c;
  }
  return null;
}

function collectTransitive(manifest, entry) {
  const ids = new Set();
  const visited = new Set();
  const q = [entry, ...[...manifest.values()].filter((c) => c.isEntry)];
  while (q.length) {
    const ch = q.shift();
    if (!ch?.file) continue;
    const f = String(ch.file);
    if (visited.has(f)) continue;
    visited.add(f);
    ids.add(f);
    if (ch.css?.forEach) ch.css.forEach((c) => ids.add(String(c)));
    if (ch.imports?.forEach) {
      ch.imports.forEach((i) => {
        if (manifest.has(String(i))) q.push(manifest.get(String(i)));
      });
    }
  }
  return ids;
}

// ── Baseline delta enforcement ─────────────────────────────────────────────
function loadBaseline() {
  const baselinePath = path.resolve(rootDir, 'bundle-baseline.json');
  if (!fs.existsSync(baselinePath) || NO_BASELINE) return null;
  try { return JSON.parse(fs.readFileSync(baselinePath, 'utf8')); }
  catch { return null; }
}

function checkBaselineDelta(distDir, manifest, bufs, baseline) {
  if (!baseline?.routes) return { sections: [], violations: [] };
  const sections = [];
  const violations = [];
  for (const [routeName, br] of Object.entries(baseline.routes)) {
    const cfg = routeBudgets[routeName];
    if (!cfg) continue;
    const entry = resolveEntry(manifest, routeName, String(cfg.entry));
    if (!entry?.file) continue;
    const entryBuf = bufs.get(String(entry.file));
    if (!entryBuf) continue;
    const entryGz = gzippedSize(entryBuf);
    let totalGz = 0;
    for (const fid of collectTransitive(manifest, entry)) {
      const b = bufs.get(String(fid));
      if (b) totalGz += gzippedSize(b);
    }
    const baseEntry = br.gzip || 0;
    const baseTotal = br.totalTransitive?.gzip || 0;
    const entryDelta = entryGz - baseEntry;
    const totalDelta = totalGz - baseTotal;
    const totalPct = baseTotal > 0 ? ((totalGz - baseTotal) / baseTotal) * 100 : 0;
    const entryFail = entryDelta > 10 * 1024;
    const totalFail = totalPct > 3;
    const passed = !entryFail && !totalFail;
    if (!passed) violations.push({ route: routeName });
    sections.push({ route: routeName, entryDelta, totalDelta, totalPct, entryFail, totalFail, passed });
  }
  return { sections, violations };
}

// ── Boundary rules enforcement ─────────────────────────────────────────────
function checkBoundaryRules(manifest) {
  const violations = [];
  for (const [name, cfg] of Object.entries(boundaryRules)) {
    const entrySrc = String(cfg.entry || '');
    const forbidden = cfg.forbiddenImports || [];
    if (!entrySrc || forbidden.length === 0) continue;
    const entryChunk = resolveEntry(manifest, name, entrySrc);
    if (!entryChunk) continue;
    const visited = new Set();
    const queue = [entryChunk];
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (!chunk?.file) continue;
      const chunkFile = String(chunk.file);
      if (visited.has(chunkFile)) continue;
      visited.add(chunkFile);
      const chunkName = chunk.name || chunkFile;
      for (const f of forbidden) {
        if (chunkName.includes(f) || chunkFile.includes(f)) {
          violations.push({ boundary: name, forbidden: f, chunk: chunkFile, description: cfg.description });
        }
      }
      if (chunk.imports?.forEach) {
        for (const id of chunk.imports) {
          if (manifest.has(String(id))) queue.push(manifest.get(String(id)));
        }
      }
    }
  }
  // Independent lazy boundaries — only check direct imports, not transitive
  const independent = ['reader-core', 'admin-route', 'reader-route'];
  for (const boundary of independent) {
    for (const [, chunk] of manifest) {
      if (chunk.name === boundary && chunk.imports?.length > 0) {
        for (const id of chunk.imports) {
          const imp = manifest.get(String(id));
          // Only flag if the imported chunk IS one of the independent boundaries (exact name match)
          // and it's a direct import (not through shared vendor chunks like react, etc.)
          if (imp && imp.name && independent.includes(imp.name) && imp.name !== boundary) {
            // Skip if the imported chunk is a shared vendor (common chunks shared across boundaries)
            const isSharedVendor = !imp.isEntry || imp.name.includes('vendor') || imp.name.includes('react');
            if (!isSharedVendor) {
              violations.push({
                boundary, forbidden: imp.name, chunk: String(chunk.file),
                description: `Independent lazy boundary ${boundary} must not import ${imp.name}`,
              });
            }
          }
        }
      }
    }
  }
  return violations;
}

// ── Route-aware budget checking ────────────────────────────────────────────
function checkRouteBudgets(distDir, manifest, fileMap, brotliMap) {
  const results = [];
  for (const [routeName, cfg] of Object.entries(routeBudgets)) {
    const entrySrc = String(cfg.entry);
    const maxSize = Number(cfg.maxSize);
    const entryChunk = resolveEntry(manifest, routeName, entrySrc);
    if (!entryChunk) continue;

    const collected = new Set();
    const visited = new Set();
    const queue = [...[...manifest.values()].filter((c) => c.isEntry), entryChunk];
    while (queue.length) {
      const chunk = queue.shift();
      if (!chunk?.file) continue;
      const f = String(chunk.file);
      if (visited.has(f)) continue;
      visited.add(f);
      collected.add(f);
      if (chunk.css?.forEach) chunk.css.forEach((c) => collected.add(String(c)));
      if (chunk.imports?.forEach) {
        for (const id of chunk.imports) {
          if (manifest.has(String(id))) queue.push(manifest.get(String(id)));
        }
      }
    }

    let totalSize = 0;
    let totalBrotli = 0;
    for (const fid of collected) {
      const fullPath = path.resolve(distDir, fid);
      if (fullPath.startsWith(distDir) && fileMap.has(fullPath)) {
        totalSize += fileMap.get(fullPath);
        totalBrotli += brotliMap.get(fullPath) || 0;
      }
    }
    results.push({ route: routeName, size: totalSize, brotliSize: totalBrotli, limit: maxSize, passed: totalSize <= maxSize });
  }
  return results;
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  const distDir = distDirArg();
  if (!distDir.startsWith(rootDir)) {
    console.error(`Error: dist directory must be within repository (${rootDir})`);
    process.exit(2);
  }
  if (!fs.existsSync(distDir)) {
    console.error(`Error: dist directory not found at ${distDir}. Run 'pnpm build' first.`);
    process.exit(2);
  }

  const files = walk(distDir);
  const bufs = new Map();
  const fileMap = new Map();
  const brotliMap = new Map();
  for (const fp of files) {
    const buf = fs.readFileSync(fp);
    const rel = path.relative(distDir, fp);
    bufs.set(rel, buf);
    fileMap.set(fp, buf.length);
    try { brotliMap.set(fp, zlib.brotliCompressSync(buf).length); }
    catch { brotliMap.set(fp, 0); }
  }

  // ── Per-file gzipped budgets ────────────────────────────────────────────
  const rows = [];
  let violations = 0;
  for (const file of files) {
    const buf = fs.readFileSync(file);
    const gzSize = gzippedSize(buf);
    const brSize = brotliSize(buf);
    const { kind } = classify(path.basename(file));
    const budget = budgetFor(kind);

    if (budget === null) {
      rows.push({ relPath: path.relative(distDir, file), kind, gzSize, brotliSize: brSize, budget, status: '· (uncounted)' });
      continue;
    }
    const passed = gzSize / 1024 <= budget;
    if (!passed) violations += 1;
    rows.push({ relPath: path.relative(distDir, file), kind, gzSize, brotliSize: brSize, budget, status: passed ? '✅' : '❌' });
  }
  rows.sort((a, b) => b.gzSize - a.gzSize);

  const tableLines = [
    '| File | Kind | Gzipped (KB) | Brotli (KB) | Budget (KB) | Status |',
    '| :--- | :--- | ---: | ---: | ---: | :--- |',
  ];
  for (const r of rows) {
    const budget = r.budget === null ? '—' : r.budget.toFixed(2);
    tableLines.push(`| \`${r.relPath}\` | ${r.kind} | ${formatKb(r.gzSize)} | ${formatKb(r.brotliSize)} | ${budget} | ${r.status} |`);
  }

  const summary = [
    '### Bundle budget (gzipped + brotli) — ADR-107 §3',
    '',
    tableLines.join('\n'),
    '',
    `Budgets: main JS ${BUDGETS.mainJs} KB · main CSS ${BUDGETS.mainCss} KB · lazy chunk ${BUDGETS.lazyChunkJs} KB`,
    `Files measured: ${rows.filter((r) => r.budget !== null).length} · Violations: ${violations}`,
  ].join('\n');
  console.log(summary);

  const metricsOutput = { bundleSize: rows.map((r) => ({ file: r.relPath, size: r.gzSize, limit: r.budget ? r.budget * 1024 : 0, passed: r.status === '✅' })) };

  // ── Baseline delta enforcement ──────────────────────────────────────────
  const manifest = loadManifest(distDir);
  const baseline = loadBaseline();
  if (manifest && baseline) {
    const { sections, violations: bv } = checkBaselineDelta(distDir, manifest, bufs, baseline);
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
      violations += bv.length;
    }
  }

  // ── Boundary rules enforcement ──────────────────────────────────────────
  const boundaryViolations = manifest ? checkBoundaryRules(manifest) : [];
  if (boundaryViolations.length > 0) {
    console.log('\n### Bundle Boundary Violations');
    console.log('| Boundary | Forbidden Import | Violating Chunk | Description |');
    console.log('| :--- | :--- | :--- | :--- |');
    for (const v of boundaryViolations) {
      console.log(`| ${v.boundary} | ${v.forbidden} | ${v.chunk} | ${v.description} |`);
    }
    violations += boundaryViolations.length;
    metricsOutput.boundaryViolations = boundaryViolations;
  }

  // ── Route-aware budgets ─────────────────────────────────────────────────
  if (manifest && Object.keys(routeBudgets).length > 0) {
    const routeResults = checkRouteBudgets(distDir, manifest, fileMap, brotliMap);
    if (routeResults.length > 0) {
      console.log('\n### Route-Aware Budgets');
      console.log('| Route | Total Gzip (KB) | Total Brotli (KB) | Limit (KB) | Status |');
      console.log('| :--- | ---: | ---: | ---: | :--- |');
      for (const r of routeResults) {
        const status = r.passed ? '✅' : '❌';
        console.log(`| ${r.route} | ${(r.size / 1024).toFixed(2)} | ${(r.brotliSize / 1024).toFixed(2)} | ${(r.limit / 1024).toFixed(2)} | ${status} |`);
        if (!r.passed) violations += 1;
      }
      metricsOutput.routeBudgets = routeResults;
    }
  }

  // ── METRICS_OUTPUT ──────────────────────────────────────────────────────
  if (process.env.METRICS_OUTPUT) {
    const out = String(process.env.METRICS_OUTPUT);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(metricsOutput, null, 2));
  }

  // ── Report file ─────────────────────────────────────────────────────────
  if (process.env.BUNDLE_BUDGET_REPORT) {
    const reportPath = path.resolve(process.env.BUNDLE_BUDGET_REPORT);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, summary + '\n');
  }

  if (violations > 0 && FAIL_ON_VIOLATION) {
    console.error(`\n❌ Bundle budget exceeded (${violations} violation(s)). See ADR-107 §3.`);
    process.exit(1);
  } else if (violations > 0) {
    console.warn(`\n⚠ Bundle budget exceeded (${violations} violation(s)) — not failing (set BUNDLE_BUDGET_FAIL_ON_VIOLATION=1 to enforce).`);
  } else {
    console.log('\n✅ All bundles within gzipped budget.');
  }
}

main();

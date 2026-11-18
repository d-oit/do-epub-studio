#!/usr/bin/env node
// scripts/bundle-baseline.mjs
//
// Generate a committed baseline artifact capturing per-route gzipped and
// Brotli sizes for entry chunks and their transitive dependencies.
//
// Reads the Vite manifest from the build output, walks import graphs,
// and writes bundle-baseline.json to the repo root (or --output path).
//
// Usage:
//   node scripts/bundle-baseline.mjs [--output <path>] [--dist <dir>]
//
// Exit codes:
//   0  Baseline written successfully
//   2  Bad arguments, missing manifest, or dist directory missing

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  let outputPath = path.resolve(rootDir, 'bundle-baseline.json');
  let distDir = path.resolve(rootDir, 'apps/web/dist');
  const seen = new Set();

  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag !== '--output' && flag !== '--dist') {
      console.error(`Error: unknown argument "${flag}"`);
      process.exit(2);
    }
    if (seen.has(flag)) {
      console.error(`Error: argument "${flag}" may only be supplied once`);
      process.exit(2);
    }
    seen.add(flag);
    const value = args[++i];
    if (!value || value.startsWith('--')) {
      console.error(`Error: ${flag} requires a path value`);
      process.exit(2);
    }
    if (flag === '--output') outputPath = path.resolve(rootDir, value);
    else distDir = path.resolve(rootDir, value);
  }
  return { outputPath, distDir };
}

function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

// ── Compression helpers ─────────────────────────────────────────────────
function gzipSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length;
}

function brotliSize(buffer) {
  return zlib.brotliCompressSync(buffer).length;
}

// ── File walker ─────────────────────────────────────────────────────────
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

// ── Route resolution ────────────────────────────────────────────────────
function loadRouteBudgets() {
  const budgetsPath = path.resolve(rootDir, '.performance-budgets.json');
  if (!fs.existsSync(budgetsPath)) {
    console.error(`Error: budgets file not found at ${budgetsPath}`);
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(budgetsPath, 'utf8'));
  const routes = raw.routeBudgets;
  if (!isRecord(routes) || Object.keys(routes).length === 0) {
    console.error('Error: .performance-budgets.json has no configured route budgets');
    process.exit(2);
  }
  for (const [name, config] of Object.entries(routes)) {
    if (!isRecord(config) || typeof config.entry !== 'string' || config.entry.length === 0) {
      console.error(`Error: route "${name}" has no configured entry source`);
      process.exit(2);
    }
  }
  return routes;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolveEntryChunk(routeName, entrySrc, manifest) {
  if (manifest.has(entrySrc)) return manifest.get(entrySrc);
  const slug = `${routeName}-route`;
  for (const chunk of manifest.values()) {
    if (isRecord(chunk) && (chunk.src === entrySrc || chunk.name === slug)) {
      return chunk;
    }
  }
  return null;
}

// BFS over imports to collect all transitive file IDs for a route
function collectTransitive(routeName, entryChunk, manifest, fail) {
  const collectedFileIds = new Set();
  const queue = [entryChunk];
  const visited = new Set();
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const chunk = queue[queueIndex++];
    if (!isRecord(chunk)) {
      fail(`route "${routeName}": manifest contains an invalid chunk`);
      continue;
    }
    if (typeof chunk.file !== 'string' || chunk.file.length === 0) {
      fail(`route "${routeName}": manifest chunk has no output file`);
      continue;
    }
    const chunkFile = chunk.file;
    if (visited.has(chunkFile)) continue;
    visited.add(chunkFile);
    collectedFileIds.add(chunkFile);

    if (chunk.css !== undefined && !Array.isArray(chunk.css)) {
      fail(`route "${routeName}": manifest CSS list for "${chunkFile}" is invalid`);
    } else {
      for (const cssFile of chunk.css || []) {
        if (typeof cssFile !== 'string' || cssFile.length === 0) {
          fail(`route "${routeName}": manifest CSS reference for "${chunkFile}" is invalid`);
        } else {
          collectedFileIds.add(cssFile);
        }
      }
    }

    if (chunk.imports !== undefined && !Array.isArray(chunk.imports)) {
      fail(`route "${routeName}": manifest imports for "${chunkFile}" are invalid`);
    } else {
      for (const importId of chunk.imports || []) {
        if (typeof importId !== 'string' || !manifest.has(importId)) {
          fail(`route "${routeName}": manifest import "${String(importId)}" is unresolved`);
        } else {
          queue.push(manifest.get(importId));
        }
      }
    }
  }

  return collectedFileIds;
}

// ── Main ────────────────────────────────────────────────────────────────
function main() {
  const { outputPath, distDir } = parseArgs();

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
    console.error(`Error: dist directory must resolve within repository (${realRoot})`);
    process.exit(2);
  }

  const manifestPaths = [
    path.join(distDir, '.vite', 'manifest.json'),
    path.join(distDir, 'manifest.json'),
  ];
  const manifestPath = manifestPaths.find((candidate) => fs.existsSync(candidate));
  if (!manifestPath) {
    console.error(`Error: Vite manifest not found under ${distDir}. Run 'pnpm build' first.`);
    process.exit(2);
  }
  let manifestData;
  try {
    manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    console.error(`Error: Vite manifest ${manifestPath} is unreadable/invalid: ${error.message}`);
    process.exit(2);
  }
  if (!isRecord(manifestData) || Object.keys(manifestData).length === 0) {
    console.error(`Error: Vite manifest ${manifestPath} must contain build entries`);
    process.exit(2);
  }
  const manifest = new Map(Object.entries(manifestData));
  const allFiles = new Map(); // path -> buffer
  for (const fp of walk(distDir)) {
    allFiles.set(path.relative(distDir, fp), fs.readFileSync(fp));
  }

  const routeBudgets = loadRouteBudgets();
  const failures = [];
  const fail = (message) => failures.push(message);
  const baseline = {
    generated: new Date().toISOString().slice(0, 10),
    routes: {},
  };

  for (const [routeName, config] of Object.entries(routeBudgets)) {
    const entrySrc = config.entry;
    const entryChunk = resolveEntryChunk(routeName, entrySrc, manifest);
    if (!isRecord(entryChunk)) {
      fail(
        `route "${routeName}": entry "${entrySrc}" not found in Vite manifest — run a full build (manifest: true) before generating a baseline`,
      );
      continue;
    }

    if (typeof entryChunk.file !== 'string' || entryChunk.file.length === 0) {
      fail(`route "${routeName}": manifest entry "${entrySrc}" has no output file`);
      continue;
    }
    const entryFile = entryChunk.file;
    const entryBuf = allFiles.get(entryFile);
    if (!entryBuf) {
      fail(`route "${routeName}": entry chunk file "${entryFile}" missing from dist (${distDir})`);
      continue;
    }

    const entryGzip = gzipSize(entryBuf);
    const entryBrotli = brotliSize(entryBuf);
    const transitiveIds = collectTransitive(routeName, entryChunk, manifest, fail);
    let totalGzip = 0;
    let totalBrotli = 0;
    for (const fileId of transitiveIds) {
      const buffer = allFiles.get(String(fileId));
      if (!buffer) {
        fail(
          `route "${routeName}": transitive artifact "${fileId}" missing from dist (${distDir})`,
        );
        continue;
      }
      totalGzip += gzipSize(buffer);
      totalBrotli += brotliSize(buffer);
    }

    baseline.routes[routeName] = {
      entry: entryFile,
      gzip: entryGzip,
      brotli: entryBrotli,
      totalTransitive: {
        gzip: totalGzip,
        brotli: totalBrotli,
      },
    };

    console.log(
      `  ${routeName}: entry gzip=${(entryGzip / 1024).toFixed(1)}KB brotli=${(entryBrotli / 1024).toFixed(1)}KB | total gzip=${(totalGzip / 1024).toFixed(1)}KB brotli=${(totalBrotli / 1024).toFixed(1)}KB`,
    );
  }

  if (failures.length > 0) {
    console.error(
      `Error: baseline generation incomplete — ${failures.length} route(s) could not be measured:`,
    );
    for (const message of failures) console.error(`  - ${message}`);
    console.error('No baseline written; fix the build output and re-run.');
    process.exit(2);
  }

  fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`\nBaseline written to ${path.relative(rootDir, outputPath)}`);
}

main();

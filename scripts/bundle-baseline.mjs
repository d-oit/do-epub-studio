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

// ── CLI args ────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let outputPath = path.resolve(rootDir, 'bundle-baseline.json');
  let distDir = path.resolve(rootDir, 'apps/web/dist');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputPath = path.resolve(rootDir, args[++i]);
    } else if (args[i] === '--dist' && args[i + 1]) {
      distDir = path.resolve(rootDir, args[++i]);
    }
  }
  return { outputPath, distDir };
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
    } else {
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
  return raw.routeBudgets || {};
}

function resolveEntryChunk(routeName, entrySrc, manifest) {
  if (manifest.has(entrySrc)) {
    return manifest.get(entrySrc);
  }
  const slug = routeName + '-route';
  for (const chunk of manifest.values()) {
    if (chunk.src === entrySrc || chunk.name === slug) {
      return chunk;
    }
  }
  return null;
}

// BFS over imports to collect all transitive file IDs for a route
function collectTransitive(entryChunk, manifest) {
  const collectedFileIds = new Set();
  const queue = [entryChunk];
  const visited = new Set();

  // The index/main entry is always loaded
  for (const c of manifest.values()) {
    if (c.isEntry) {
      queue.push(c);
    }
  }

  while (queue.length > 0) {
    const chunk = queue.shift();
    if (!chunk || !chunk.file) continue;
    const chunkFile = String(chunk.file);
    if (visited.has(chunkFile)) continue;
    visited.add(chunkFile);

    collectedFileIds.add(chunkFile);
    if (chunk.css && Array.isArray(chunk.css)) {
      for (const cssFile of chunk.css) {
        collectedFileIds.add(String(cssFile));
      }
    }
    if (chunk.imports && Array.isArray(chunk.imports)) {
      for (const importId of chunk.imports) {
        const id = String(importId);
        if (manifest.has(id)) {
          queue.push(manifest.get(id));
        }
      }
    }
  }

  return collectedFileIds;
}

// ── Main ────────────────────────────────────────────────────────────────
function main() {
  const { outputPath, distDir } = parseArgs();

  if (!distDir.startsWith(rootDir)) {
    console.error(`Error: dist directory must be within repository (${rootDir})`);
    process.exit(2);
  }
  if (!fs.existsSync(distDir)) {
    console.error(`Error: dist directory not found at ${distDir}. Run 'pnpm build' first.`);
    process.exit(2);
  }

  // Locate manifest
  const manifestPaths = [
    path.join(distDir, '.vite', 'manifest.json'),
    path.join(distDir, 'manifest.json'),
  ];
  let manifestPath = null;
  for (const p of manifestPaths) {
    if (fs.existsSync(p)) {
      manifestPath = p;
      break;
    }
  }
  if (!manifestPath) {
    console.error('Error: No Vite manifest found. Run build with manifest: true.');
    process.exit(2);
  }

  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const manifest = new Map(Object.entries(manifestData));
  const routeBudgets = loadRouteBudgets();
  const allFiles = new Map(); // path -> buffer
  for (const fp of walk(distDir)) {
    allFiles.set(path.relative(distDir, fp), fs.readFileSync(fp));
  }

  const baseline = {
    generated: new Date().toISOString().slice(0, 10),
    routes: {},
  };

  for (const [routeName, config] of Object.entries(routeBudgets)) {
    const entrySrc = String(config.entry);
    const entryChunk = resolveEntryChunk(routeName, entrySrc, manifest);
    if (!entryChunk) {
      console.warn(`Warning: Could not find manifest entry for route "${routeName}" (entry: ${entrySrc})`);
      continue;
    }

    const entryFile = String(entryChunk.file);
    const entryBuf = allFiles.get(entryFile);
    if (!entryBuf) {
      console.warn(`Warning: Entry chunk file not found in dist: ${entryFile}`);
      continue;
    }

    const entryGzip = gzipSize(entryBuf);
    const entryBrotli = brotliSize(entryBuf);

    // Transitive
    const transitiveIds = collectTransitive(entryChunk, manifest);
    let totalGzip = 0;
    let totalBrotli = 0;
    for (const fileId of transitiveIds) {
      const buf = allFiles.get(String(fileId));
      if (buf) {
        totalGzip += gzipSize(buf);
        totalBrotli += brotliSize(buf);
      }
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

    console.log(`  ${routeName}: entry gzip=${(entryGzip / 1024).toFixed(1)}KB brotli=${(entryBrotli / 1024).toFixed(1)}KB | total gzip=${(totalGzip / 1024).toFixed(1)}KB brotli=${(totalBrotli / 1024).toFixed(1)}KB`);
  }

  fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`\nBaseline written to ${path.relative(rootDir, outputPath)}`);
}

main();

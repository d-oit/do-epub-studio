import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const [overrideDistDir] = process.argv.slice(2);
const distDirInput = String(overrideDistDir || 'apps/web/dist');
const distDir = path.resolve(rootDir, distDirInput);
const budgetsPath = path.resolve(rootDir, '.performance-budgets.json');

// Safety: Ensure we stay within root
if (!distDir.startsWith(rootDir)) {
  console.error(`Error: Dist directory must be within the repository (${rootDir})`);
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error(`Error: Dist directory not found at ${distDir}. Run build first.`);
  process.exit(1);
}

if (!fs.existsSync(budgetsPath)) {
  console.error(`Error: Budgets file not found at ${budgetsPath}.`);
  process.exit(1);
}

const budgetConfig = JSON.parse(fs.readFileSync(budgetsPath, 'utf8'));
const budgets = budgetConfig.bundleSize;
const routeBudgets = budgetConfig.routeBudgets || {};

// Pre-scan all files and sizes to avoid dynamic path construction in hot loops
function getFilesRecursive(dir) {
  const fileMap = new Map();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = getFilesRecursive(res);
      for (const [k, v] of nested.entries()) {
        fileMap.set(k, v);
      }
    } else {
      fileMap.set(res, fs.statSync(res).size);
    }
  }
  return fileMap;
}

const fileMap = getFilesRecursive(distDir);
const results = [];
let hasError = false;

// 1. Traditional individual chunk budgets
for (const [pattern, limit] of Object.entries(budgets)) {
  const patternStr = String(pattern);
  const limitNum = Number(limit);

  for (const [filePath, fileSize] of fileMap.entries()) {
    const fileName = path.basename(filePath);
    let matches = false;

    if (patternStr.includes('.')) {
      const parts = patternStr.split('.');
      const base = parts[0];
      const ext = parts[1];
      const suffix = '.' + ext;
      if (fileName === patternStr || (fileName.startsWith(base + '-') && fileName.endsWith(suffix))) {
        matches = true;
      }
    } else if (fileName === patternStr) {
      matches = true;
    }

    if (matches) {
      const passed = fileSize <= limitNum;
      if (!passed) hasError = true;

      results.push({
        file: path.relative(distDir, filePath),
        size: fileSize,
        limit: limitNum,
        passed,
        type: 'chunk'
      });
    }
  }
}

// 2. Route-aware budgets using Vite manifest
const manifestPathVite = path.join(distDir, '.vite', 'manifest.json');
const manifestPathRoot = path.join(distDir, 'manifest.json');
let manifestPath = null;

if (fs.existsSync(manifestPathVite)) {
  manifestPath = manifestPathVite;
} else if (fs.existsSync(manifestPathRoot)) {
  manifestPath = manifestPathRoot;
}

const routeResults = [];

if (manifestPath) {
  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const manifest = new Map(Object.entries(manifestData));

  for (const [routeName, config] of Object.entries(routeBudgets)) {
    const entrySrc = String(config.entry);
    const maxSize = Number(config.maxSize);

    let entryChunk = null;
    if (manifest.has(entrySrc)) {
      entryChunk = manifest.get(entrySrc);
    } else {
      const routeNameSlug = routeName + '-route';
      for (const chunk of manifest.values()) {
        if (chunk.src === entrySrc || chunk.name === routeNameSlug) {
          entryChunk = chunk;
          break;
        }
      }
    }

    if (!entryChunk) {
      console.warn(`Warning: Could not find manifest entry for route "${routeName}" (entry: ${entrySrc})`);
      continue;
    }

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

    let totalSize = 0;
    const details = [];
    for (const fileId of collectedFileIds) {
      const fileName = String(fileId);
      const fullPath = path.join(distDir, fileName);

      // Use pre-scanned fileMap to avoid dynamic statSync
      if (fileMap.has(fullPath)) {
        const size = fileMap.get(fullPath);
        totalSize += size;
        details.push({ file: fileName, size });
      }
    }

    const passed = totalSize <= maxSize;
    if (!passed) hasError = true;

    routeResults.push({
      route: routeName,
      size: totalSize,
      limit: maxSize,
      passed,
      details
    });
  }
} else {
  console.warn('Warning: No Vite manifest found. Skipping route-aware budget checks.');
}

console.log('### Bundle Size Check Results');
console.log('| File | Size (KB) | Limit (KB) | Status |');
console.log('| :--- | :--- | :--- | :--- |');

for (const res of results) {
  const status = res.passed ? '✅' : '❌';
  console.log(`| ${res.file} | ${(res.size / 1024).toFixed(2)} | ${(res.limit / 1024).toFixed(2)} | ${status} |`);
}

if (routeResults.length > 0) {
  console.log('\n### Route-Aware Budgets');
  console.log('| Route | Total Size (KB) | Limit (KB) | Status |');
  console.log('| :--- | :--- | :--- | :--- |');
  for (const res of routeResults) {
    const status = res.passed ? '✅' : '❌';
    console.log(`| ${res.route} | ${(res.size / 1024).toFixed(2)} | ${(res.limit / 1024).toFixed(2)} | ${status} |`);
  }
}

// Write to a temporary file for the CI reporter
if (process.env.METRICS_OUTPUT) {
  const output = {
    bundleSize: results,
    routeBudgets: routeResults
  };
  fs.writeFileSync(process.env.METRICS_OUTPUT, JSON.stringify(output, null, 2));
}

if (hasError) {
  console.error('\n❌ Bundle size budget exceeded!');
  process.exit(1);
} else {
  console.log('\n✅ All bundle sizes are within budget.');
}

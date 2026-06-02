import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const [overrideDistDir] = process.argv.slice(2);
const distDirInput = overrideDistDir || 'apps/web/dist';
const distDir = path.resolve(rootDir, distDirInput);
const budgetsPath = path.resolve(rootDir, '.performance-budgets.json');

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

function getFiles(dir, allFiles = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, allFiles);
    } else {
      allFiles.push(name);
    }
  }
  return allFiles;
}

const allFiles = getFiles(distDir);
const results = [];
let hasError = false;

// 1. Traditional individual chunk budgets
for (const [pattern, limit] of Object.entries(budgets)) {
  const matchingFiles = allFiles.filter(f => {
    const fileName = path.basename(f);
    if (pattern.includes('.')) {
      const parts = pattern.split('.');
      const base = parts[0];
      const ext = parts[1];
      const suffix = '.' + ext;
      return fileName === pattern || (fileName.startsWith(base + '-') && fileName.endsWith(suffix));
    }
    return fileName === pattern;
  });

  if (matchingFiles.length === 0) {
    console.warn(`Warning: No files found matching pattern "${pattern}"`);
    continue;
  }

  for (const file of matchingFiles) {
    const stats = fs.statSync(file);
    const size = stats.size;
    const passed = size <= limit;
    if (!passed) hasError = true;

    results.push({
      file: path.relative(distDir, file),
      size,
      limit,
      passed,
      type: 'chunk'
    });
  }
}

// 2. Route-aware budgets using Vite manifest
const manifestFiles = [
  path.join(distDir, '.vite', 'manifest.json'),
  path.join(distDir, 'manifest.json')
];
let manifestPath = null;
for (const p of manifestFiles) {
  if (fs.existsSync(p)) {
    manifestPath = p;
    break;
  }
}

const routeResults = [];

if (manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  for (const [routeName, config] of Object.entries(routeBudgets)) {
    const entrySrc = config.entry;

    let entryChunk = null;
    if (Object.prototype.hasOwnProperty.call(manifest, entrySrc)) {
      entryChunk = manifest[entrySrc];
    } else {
      const routeNameSlug = routeName + '-route';
      for (const key of Object.keys(manifest)) {
        const chunk = manifest[key];
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

    const collectedFiles = new Set();
    const queue = [entryChunk];
    const visited = new Set();

    // The index/main entry is always loaded
    for (const key of Object.keys(manifest)) {
      const c = manifest[key];
      if (c.isEntry) {
        queue.push(c);
      }
    }

    while (queue.length > 0) {
      const chunk = queue.shift();
      const chunkId = chunk.file;
      if (visited.has(chunkId)) continue;
      visited.add(chunkId);

      collectedFiles.add(chunk.file);
      if (chunk.css) {
        for (const c of chunk.css) {
          collectedFiles.add(c);
        }
      }

      if (chunk.imports) {
        for (const importId of chunk.imports) {
          if (Object.prototype.hasOwnProperty.call(manifest, importId)) {
            queue.push(manifest[importId]);
          }
        }
      }
    }

    let totalSize = 0;
    const details = [];
    for (const file of collectedFiles) {
      const fullPath = path.resolve(distDir, String(file));
      // Guard against directory traversal by ensuring it's still within distDir
      if (fullPath.startsWith(distDir) && fs.existsSync(fullPath)) {
        const size = fs.statSync(fullPath).size;
        totalSize += size;
        details.push({ file, size });
      }
    }

    const passed = totalSize <= config.maxSize;
    if (!passed) hasError = true;

    routeResults.push({
      route: routeName,
      size: totalSize,
      limit: config.maxSize,
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

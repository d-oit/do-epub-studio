import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const [overrideDistDir] = process.argv.slice(2);
const distDir = overrideDistDir ? path.resolve(overrideDistDir) : path.resolve(rootDir, 'apps/web/dist');
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

const budgets = JSON.parse(fs.readFileSync(budgetsPath, 'utf8')).bundleSize;

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

for (const [pattern, limit] of Object.entries(budgets)) {
  const matchingFiles = allFiles.filter(f => {
    const fileName = path.basename(f);
    // Handle patterns like 'index.js' matching 'index-C55ObYsH.js' (Vite hashed assets)
    if (pattern.includes('.')) {
      const [base, ext] = pattern.split('.');
      const suffix = '.' + ext;
      return fileName.startsWith(base) && fileName.endsWith(suffix) && fileName.length > base.length + suffix.length;
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
      passed
    });
  }
}

console.log('### Bundle Size Check Results');
console.log('| File | Size (KB) | Limit (KB) | Status |');
console.log('| :--- | :--- | :--- | :--- |');

for (const res of results) {
  const status = res.passed ? '✅' : '❌';
  console.log(`| ${res.file} | ${(res.size / 1024).toFixed(2)} | ${(res.limit / 1024).toFixed(2)} | ${status} |`);
}

// Write to a temporary file for the CI reporter if requested
if (process.env.METRICS_OUTPUT) {
  const output = { bundleSize: results };
  fs.writeFileSync(process.env.METRICS_OUTPUT, JSON.stringify(output, null, 2));
}

if (hasError) {
  console.error('\n❌ Bundle size budget exceeded!');
  process.exit(1);
} else {
  console.log('\n✅ All bundle sizes are within budget.');
}

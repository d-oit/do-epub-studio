import fs from 'node:fs';
import path from 'node:path';

const [baselinePath, currentPath, thresholdArg] = process.argv.slice(2);

if (!baselinePath || !currentPath) {
  console.error('Usage: node compare-benchmarks.mjs <baseline.json> <current.json> [threshold]');
  process.exit(1);
}

const threshold = thresholdArg ? parseFloat(thresholdArg) : 10;

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${p}: ${err.message}`);
    return null;
  }
}

const baseline = readJson(baselinePath);
const current = readJson(currentPath);

if (!baseline || !current) {
  process.exit(1);
}

function getBenchmarks(data) {
  const benchs = new Map();
  for (const file of data.files || []) {
    for (const group of file.groups || []) {
      for (const bench of group.benchmarks || []) {
        // Use full name if available to distinguish benchmarks with same name in different groups
        const name = group.fullName ? `${group.fullName} > ${bench.name}` : bench.name;
        benchs.set(name, bench);
      }
    }
  }
  return benchs;
}

const baselineBenchs = getBenchmarks(baseline);
const currentBenchs = getBenchmarks(current);

const results = [];
let hasRegression = false;

for (const [name, currentBench] of currentBenchs) {
  const baselineBench = baselineBenchs.get(name);
  if (!baselineBench) {
    results.push({ name, current: currentBench.hz, baseline: null, change: null });
    continue;
  }

  const change = ((currentBench.hz - baselineBench.hz) / baselineBench.hz) * 100;
  const isRegression = change < -threshold;
  if (isRegression) {
    hasRegression = true;
  }

  results.push({
    name,
    current: currentBench.hz,
    baseline: baselineBench.hz,
    change,
    isRegression
  });
}

// Format Markdown table
let markdown = '### Benchmark Comparison\n\n';
markdown += '| Benchmark | Baseline (ops/s) | Current (ops/s) | Change | Status |\n';
markdown += '| :--- | :--- | :--- | :--- | :--- |\n';

for (const res of results) {
  const baselineStr = res.baseline ? res.baseline.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A';
  const currentStr = res.current.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const changeStr = res.change !== null ? `${res.change > 0 ? '+' : ''}${res.change.toFixed(2)}%` : 'NEW';

  let status = '✅';
  if (res.change === null) status = '🆕';
  else if (res.isRegression) status = '❌';
  else if (res.change < 0) status = '⚠️'; // Small regression but under threshold

  markdown += `| ${res.name} | ${baselineStr} | ${currentStr} | ${changeStr} | ${status} |\n`;
}

if (hasRegression) {
  markdown += `\n**❌ Regression detected!** One or more benchmarks regressed by more than ${threshold}%.`;
} else {
  markdown += `\n**✅ No significant regressions detected** (threshold: ${threshold}%).`;
}

console.log(markdown);

if (hasRegression) {
  process.exit(1);
}

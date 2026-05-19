import fs from 'node:fs';
import path from 'node:path';

const [baselineArg, currentArg, thresholdArg] = process.argv.slice(2);

if (!baselineArg || !currentArg) {
  console.error('Usage: node compare-benchmarks.mjs <baseline.json> <current.json> [threshold]');
  process.exit(1);
}

const threshold = thresholdArg ? parseFloat(thresholdArg) : 20;

// Resolve paths to prevent path-traversal issues when paths come from CLI args.
const baselinePath = path.resolve(baselineArg);
const currentPath = path.resolve(currentArg);

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
  let errorMsg = '### Benchmark Comparison\n\n';
  errorMsg += `**⚠️ Error:** Could not read benchmark results.\n`;
  if (!baseline) errorMsg += `- Missing or invalid baseline: \`${baselinePath}\`\n`;
  if (!current) errorMsg += `- Missing or invalid current: \`${currentPath}\`\n`;
  console.log(errorMsg);
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

  // Guard against division by zero when baseline benchmark reports 0 ops/s.
  let change = null;
  let isRegression = false;
  if (baselineBench.hz === 0) {
    change = currentBench.hz === 0 ? 0 : Infinity;
  } else {
    change = ((currentBench.hz - baselineBench.hz) / baselineBench.hz) * 100;
    isRegression = change < -threshold;
    if (isRegression) {
      hasRegression = true;
    }
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
  // Treat 0 as a valid baseline value; only null means "no baseline available".
  const baselineStr = res.baseline !== null && res.baseline !== undefined
    ? res.baseline.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : 'N/A';
  const currentStr = res.current.toLocaleString(undefined, { maximumFractionDigits: 2 });
  let changeStr;
  if (res.change === null) {
    changeStr = 'NEW';
  } else if (!Number.isFinite(res.change)) {
    changeStr = '∞%';
  } else {
    changeStr = `${res.change > 0 ? '+' : ''}${res.change.toFixed(2)}%`;
  }

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

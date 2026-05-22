import fs from 'node:fs';
import path from 'node:path';

const [metricsDir, baselineDir] = process.argv.slice(2);

if (!metricsDir) {
  console.error('Usage: node report-performance.mjs <metrics_dir> [baseline_dir]');
  process.exit(1);
}

const metricsPath = path.resolve(metricsDir);
const baselinePath = baselineDir ? path.resolve(baselineDir) : null;
const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const budgetsPath = path.join(rootDir, '.performance-budgets.json');

function readJson(p) {
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading ${p}: ${err.message}`);
  }
  return null;
}

const budgets = readJson(budgetsPath) || { bundleSize: {}, startupTime: { fcp: 1500 }, ciDuration: { total: 900 } };
const bundleMetrics = readJson(path.join(metricsPath, 'bundle-metrics.json'));
const startupMetrics = readJson(path.join(metricsPath, 'startup-metrics.json'));
const ciMetrics = readJson(path.join(metricsPath, 'ci-metrics.json'));
const lighthouseMetrics = readJson(path.join(metricsPath, 'lighthouse-metrics.json'));

const baselineBundle = baselinePath ? readJson(path.join(baselinePath, 'bundle-metrics.json')) : null;
const baselineStartup = baselinePath ? readJson(path.join(baselinePath, 'startup-metrics.json')) : null;

let markdown = '## 🚀 Performance Report\n\n';

// Helper for trend reporting
function getChange(current, baseline) {
  if (baseline === null || baseline === undefined || baseline === 0) return null;
  const change = ((current - baseline) / baseline) * 100;
  const sign = change > 0 ? '+' : '';
  const statusIcon = change > 5 ? ' ⚠️' : (change < -5 ? ' ✅' : '');
  return `${sign}${change.toFixed(2)}%${statusIcon}`;
}

if (bundleMetrics && bundleMetrics.bundleSize) {
  markdown += '### 📦 Bundle Sizes\n\n';
  markdown += '| File | Size (KB) | Limit (KB) | Trend | Status |\n';
  markdown += '| :--- | :--- | :--- | :--- | :--- |\n';

  for (const res of bundleMetrics.bundleSize) {
    const limit = budgets.bundleSize[res.file] || budgets.bundleSize[path.basename(res.file)] || 0;
    const status = res.passed ? '✅' : '❌';

    let trend = 'NEW';
    if (baselineBundle && baselineBundle.bundleSize) {
      const baseRes = baselineBundle.bundleSize.find(b => b.file === res.file);
      if (baseRes) {
        trend = getChange(res.size, baseRes.size) || '0%';
      }
    }

    markdown += `| ${res.file} | ${(res.size / 1024).toFixed(2)} | ${(limit / 1024).toFixed(2)} | ${trend} | ${status} |\n`;
  }
  markdown += '\n';
}

if (startupMetrics && startupMetrics.startupTime) {
  markdown += '### ⚡ Startup Performance\n\n';
  markdown += '| Metric | Value (ms) | Limit (ms) | Trend | Status |\n';
  markdown += '| :--- | :--- | :--- | :--- | :--- |\n';

  const fcp = startupMetrics.startupTime.fcp;
  const fcpLimit = budgets.startupTime.fcp;
  const status = fcp < fcpLimit ? '✅' : '⚠️';

  let fcpTrend = '-';
  if (baselineStartup && baselineStartup.startupTime) {
    fcpTrend = getChange(fcp, baselineStartup.startupTime.fcp) || '0%';
  }

  markdown += `| First Contentful Paint | ${fcp.toFixed(2)} | ${fcpLimit} | ${fcpTrend} | ${status} |\n`;
  markdown += `| DOM Interactive | ${startupMetrics.startupTime.domInteractive.toFixed(2)} | - | - | - |\n`;
  markdown += `| Load Event End | ${startupMetrics.startupTime.loadEventEnd.toFixed(2)} | - | - | - |\n`;
  markdown += '\n';
}

if (lighthouseMetrics) {
  markdown += '### 🏠 Lighthouse Scores\n\n';
  markdown += '| Category | Score | Status |\n';
  markdown += '| :--- | :--- | :--- |\n';
  for (const [cat, val] of Object.entries(lighthouseMetrics)) {
    const score = (val * 100).toFixed(0);
    const status = val >= 0.9 ? '✅' : (val >= 0.5 ? '⚠️' : '❌');
    markdown += `| ${cat} | ${score} | ${status} |\n`;
  }
  markdown += '\n';
}

if (ciMetrics) {
  markdown += '### 🛠️ CI & Workflow\n\n';
  markdown += `| Metric | Value | Limit | Status |\n`;
  markdown += `| :--- | :--- | :--- | :--- |\n`;

  if (ciMetrics.duration) {
    const durationMin = (ciMetrics.duration / 60).toFixed(2);
    const limitMin = (budgets.ciDuration.total / 60).toFixed(2);
    const status = ciMetrics.duration < budgets.ciDuration.total ? '✅' : '⚠️';
    markdown += `| Total CI Duration | ${durationMin} min | ${limitMin} min | ${status} |\n`;
  }
  if (ciMetrics.cacheHit !== undefined) {
    const status = ciMetrics.cacheHit === 'true' ? '✅' : '🔄';
    markdown += `| Pnpm Cache Hit | ${ciMetrics.cacheHit === 'true' ? 'Hit' : 'Miss'} | - | ${status} |\n`;
  }
  markdown += '\n';
}

console.log(markdown);
fs.writeFileSync('performance_report.md', markdown);

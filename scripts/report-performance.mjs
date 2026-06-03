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

const budgets = readJson(budgetsPath) || {
  bundleSize: {},
  routeBudgets: {},
  startupTime: { fcp: 1500, 'chapter-switch': 300, 'offline-rehydrate': 800 },
  ciDuration: { total: 900 }
};

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

  if (bundleMetrics.routeBudgets && bundleMetrics.routeBudgets.length > 0) {
    markdown += '### 🚦 Route-Aware Budgets\n\n';
    markdown += '| Route | Size (KB) | Limit (KB) | Trend | Status |\n';
    markdown += '| :--- | :--- | :--- | :--- | :--- |\n';

    for (const res of bundleMetrics.routeBudgets) {
      const config = budgets.routeBudgets[res.route] || { maxSize: 0 };
      const limit = config.maxSize;
      const status = res.passed ? '✅' : '❌';

      let trend = 'NEW';
      if (baselineBundle && baselineBundle.routeBudgets) {
        const baseRes = baselineBundle.routeBudgets.find(b => b.route === res.route);
        if (baseRes) {
          trend = getChange(res.size, baseRes.size) || '0%';
        }
      }

      markdown += `| ${res.route} | ${(res.size / 1024).toFixed(2)} | ${(limit / 1024).toFixed(2)} | ${trend} | ${status} |\n`;
    }
    markdown += '\n';
  }
}

if (startupMetrics && startupMetrics.startupTime) {
  markdown += '### ⚡ Startup & Interaction\n\n';
  markdown += '| Metric | Value (ms) | Limit (ms) | Trend | Status |\n';
  markdown += '| :--- | :--- | :--- | :--- | :--- |\n';

  const metricsToReport = [
    { key: 'fcp', label: 'First Contentful Paint' },
    { key: 'chapter-switch', label: 'Chapter Switch Latency' },
    { key: 'offline-rehydrate', label: 'Offline Rehydrate Time' },
    { key: 'domInteractive', label: 'DOM Interactive', noLimit: true },
    { key: 'loadEventEnd', label: 'Load Event End', noLimit: true },
  ];

  for (const m of metricsToReport) {
    const val = startupMetrics.startupTime[m.key];
    if (val === undefined || val === null) continue;

    const limit = budgets.startupTime[m.key];
    const status = m.noLimit ? '-' : (val <= limit ? '✅' : '⚠️');

    let trend = '-';
    if (baselineStartup && baselineStartup.startupTime && baselineStartup.startupTime[m.key]) {
      trend = getChange(val, baselineStartup.startupTime[m.key]) || '0%';
    }

    markdown += `| ${m.label} | ${val.toFixed(2)} | ${limit || '-'} | ${trend} | ${status} |\n`;
  }
  markdown += '\n';
}

if (lighthouseMetrics) {
  markdown += '### 🏠 Lighthouse Scores\n\n';
  markdown += '| Category | Score | Status |\n';
  markdown += '| :--- | :--- | :--- |\n';
  for (const [cat, val] of Object.entries(lighthouseMetrics)) {
    // Lighthouse metrics might be coming in as 0-1 or 0-100 depending on the source
    const numericVal = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(numericVal)) continue;

    const score = (numericVal <= 1 ? numericVal * 100 : numericVal).toFixed(0);
    const normalizedVal = numericVal <= 1 ? numericVal : numericVal / 100;
    const status = normalizedVal >= 0.9 ? '✅' : (normalizedVal >= 0.5 ? '⚠️' : '❌');
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

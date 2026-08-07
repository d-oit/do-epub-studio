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
const turboMetricsRaw = readJson(path.join(metricsPath, 'turbo-metrics.json'));
const testMetricsRaw = readJson(path.join(metricsPath, 'test-metrics.json'));

const baselineBundle = baselinePath ? readJson(path.join(baselinePath, 'bundle-metrics.json')) : null;
const baselineStartup = baselinePath ? readJson(path.join(baselinePath, 'startup-metrics.json')) : null;
const baselineTurboRaw = baselinePath ? readJson(path.join(baselinePath, 'turbo-metrics.json')) : null;
const baselineTestRaw = baselinePath ? readJson(path.join(baselinePath, 'test-metrics.json')) : null;

// Handle nested structure from collect-turbo-metrics.mjs
const turboMetrics = turboMetricsRaw?.turbo || turboMetricsRaw;
const testMetrics = testMetricsRaw?.test || testMetricsRaw;
const baselineTurbo = baselineTurboRaw?.turbo || baselineTurboRaw;
const baselineTest = baselineTestRaw?.test || baselineTestRaw;

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
    const limit = res.limit || budgets.bundleSize?.[res.file] || budgets.bundleSize?.[path.basename(res.file)] || 0;
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
  markdown += `| Metric | Value | Limit | Trend | Status |\n`;
  markdown += `| :--- | :--- | :--- | :--- | :--- |\n`;

  if (ciMetrics.duration) {
    const durationMin = (ciMetrics.duration / 60).toFixed(2);
    const limitMin = (budgets.ciDuration.total / 60).toFixed(2);
    const status = ciMetrics.duration < budgets.ciDuration.total ? '✅' : '⚠️';
    let trend = '-';
    if (baselineTurbo && baselineTurbo.ciDuration) {
      trend = getChange(ciMetrics.duration, baselineTurbo.ciDuration) || '0%';
    }
    markdown += `| Total CI Duration | ${durationMin} min | ${limitMin} min | ${trend} | ${status} |\n`;
  }
  if (ciMetrics.cacheHit !== undefined) {
    const status = ciMetrics.cacheHit === 'true' ? '✅' : '🔄';
    let trend = '-';
    if (baselineTurbo && baselineTurbo.pnpmCacheHit !== undefined) {
      const baselineHit = baselineTurbo.pnpmCacheHit === 'true';
      const currentHit = ciMetrics.cacheHit === 'true';
      trend = baselineHit === currentHit ? '0%' : (currentHit ? '✅ Improved' : '🔄 Regressed');
    }
    markdown += `| Pnpm Cache Hit | ${ciMetrics.cacheHit === 'true' ? 'Hit' : 'Miss'} | - | ${trend} | ${status} |\n`;
  }
  markdown += '\n';
}

if (turboMetrics) {
  markdown += '### ⚡ Turbo Task Performance\n\n';
  markdown += `| Task | Duration (s) | Cache Status | Trend | Status |\n`;
  markdown += `| :--- | :--- | :--- | :--- | :--- |\n`;

  const tasks = turboMetrics.tasks || [];
  for (const task of tasks) {
    const durationSec = (task.duration / 1000).toFixed(2);
    const cacheStatus = task.cacheStatus || 'MISS';
    const status = cacheStatus === 'HIT' ? '✅' : '🔄';

    let trend = '-';
    if (baselineTurbo && baselineTurbo.tasks) {
      const baselineTask = baselineTurbo.tasks.find(t => t.taskId === task.taskId);
      if (baselineTask) {
        trend = getChange(task.duration, baselineTask.duration) || '0%';
      }
    }

    markdown += `| ${task.taskId} | ${durationSec} | ${cacheStatus} | ${trend} | ${status} |\n`;
  }
  markdown += '\n';

  if (turboMetrics.cacheSummary) {
    markdown += `**Cache Hit Ratio:** ${turboMetrics.cacheSummary.hitRatio}% (${turboMetrics.cacheSummary.hits}/${turboMetrics.cacheSummary.total} tasks)\n\n`;
  }
}

if (testMetrics) {
  markdown += '### 🧪 Test Stability\n\n';
  markdown += `| Metric | Value | Trend | Status |\n`;
  markdown += `| :--- | :--- | :--- | :--- |\n`;

  if (testMetrics.totalTests !== undefined) {
    let trend = '-';
    if (baselineTest && baselineTest.totalTests !== undefined) {
      trend = getChange(testMetrics.totalTests, baselineTest.totalTests) || '0%';
    }
    markdown += `| Total Tests | ${testMetrics.totalTests} | ${trend} | - |\n`;
  }

  if (testMetrics.failedTests !== undefined) {
    let trend = '-';
    if (baselineTest && baselineTest.failedTests !== undefined) {
      trend = getChange(testMetrics.failedTests, baselineTest.failedTests) || '0%';
    }
    const status = testMetrics.failedTests === 0 ? '✅' : '❌';
    markdown += `| Failed Tests | ${testMetrics.failedTests} | ${trend} | ${status} |\n`;
  }

  if (testMetrics.flakyTests !== undefined && testMetrics.flakyTests.length > 0) {
    markdown += `\n**Flaky Tests Detected (${testMetrics.flakyTests.length}):**\n`;
    for (const flaky of testMetrics.flakyTests.slice(0, 10)) {
      markdown += `- ${flaky.name} (${flaky.suite})\n`;
    }
    if (testMetrics.flakyTests.length > 10) {
      markdown += `- ... and ${testMetrics.flakyTests.length - 10} more\n`;
    }
    markdown += '\n';
  }

  if (testMetrics.flakyRate !== undefined) {
    let trend = '-';
    if (baselineTest && baselineTest.flakyRate !== undefined) {
      trend = getChange(testMetrics.flakyRate, baselineTest.flakyRate) || '0%';
    }
    const status = testMetrics.flakyRate <= 1 ? '✅' : (testMetrics.flakyRate <= 5 ? '⚠️' : '❌');
    markdown += `| Flaky Rate | ${testMetrics.flakyRate.toFixed(2)}% | ${trend} | ${status} |\n`;
  }
  markdown += '\n';
}

console.log(markdown);
fs.writeFileSync('performance_report.md', markdown);

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const [outputFile] = process.argv.slice(2);

if (!outputFile) {
  console.error('Usage: node collect-turbo-metrics.mjs <output_file>');
  process.exit(1);
}

const outputPath = path.resolve(outputFile);

async function collectTurboMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
    tasks: [],
    cacheSummary: {
      hits: 0,
      misses: 0,
      total: 0,
      hitRatio: 0
    }
  };

  try {
    // Run turbo dry-run to get cache status and task info
    const dryRunOutput = execSync('pnpm turbo run build --dry-run=json 2>/dev/null', {
      cwd: rootDir,
      encoding: 'utf8',
      timeout: 60000
    });

    const dryRunData = JSON.parse(dryRunOutput);

    if (dryRunData.tasks) {
      for (const task of dryRunData.tasks) {
        const taskMetric = {
          taskId: task.taskId,
          task: task.task,
          package: task.package,
          cacheStatus: task.cache?.status || 'MISS',
          duration: task.cache?.timeSaved || 0,
          local: task.cache?.local || false,
          remote: task.cache?.remote || false
        };

        metrics.tasks.push(taskMetric);

        if (task.cache?.status === 'HIT') {
          metrics.cacheSummary.hits++;
        } else {
          metrics.cacheSummary.misses++;
        }
      }

      metrics.cacheSummary.total = metrics.tasks.length;
      metrics.cacheSummary.hitRatio = metrics.cacheSummary.total > 0
        ? Math.round((metrics.cacheSummary.hits / metrics.cacheSummary.total) * 100)
        : 0;
    }
  } catch (error) {
    console.error(`Error collecting turbo metrics: ${error.message}`);
    // Continue with empty metrics rather than failing
  }

  return metrics;
}

async function collectTestMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
    totalTests: 0,
    failedTests: 0,
    passedTests: 0,
    flakyTests: [],
    flakyRate: 0,
    suites: []
  };

  try {
    // Look for vitest output files
    const vitestOutputFiles = [
      path.join(rootDir, 'test-results.json'),
      path.join(rootDir, 'vitest-results.json'),
      path.join(rootDir, 'coverage/coverage-summary.json')
    ];

    let vitestData = null;
    for (const file of vitestOutputFiles) {
      if (fs.existsSync(file)) {
        vitestData = JSON.parse(fs.readFileSync(file, 'utf8'));
        break;
      }
    }

    // Look for playwright results
    const playwrightResultFile = path.join(rootDir, 'test-results/playwright/.last-run.json');
    if (fs.existsSync(playwrightResultFile)) {
      const playwrightData = JSON.parse(fs.readFileSync(playwrightResultFile, 'utf8'));

      if (playwrightData.status === 'failed' && playwrightData.failedTests) {
        metrics.failedTests += playwrightData.failedTests.length;

        for (const failedTest of playwrightData.failedTests) {
          metrics.flakyTests.push({
            name: failedTest.title || 'Unknown test',
            suite: failedTest.file || 'Unknown suite',
            type: 'playwright'
          });
        }
      }
    }

    // Parse vitest output if available
    if (vitestData && vitestData.testResults) {
      for (const testResult of vitestData.testResults) {
        metrics.totalTests += testResult.numPassedTests + testResult.numFailedTests;
        metrics.failedTests += testResult.numFailedTests;
        metrics.passedTests += testResult.numPassedTests;

        // Check for flaky tests (tests that failed and then passed)
        if (testResult.flaky) {
          for (const assertion of testResult.assertionResults || []) {
            if (assertion.status === 'flaky') {
              metrics.flakyTests.push({
                name: assertion.fullName || assertion.title,
                suite: testResult.name,
                type: 'vitest'
              });
            }
          }
        }
      }
    }

    // Also look for test output in verification_output.txt (used in CI)
    const verificationOutputFile = path.join(rootDir, 'verification_output.txt');
    if (fs.existsSync(verificationOutputFile)) {
      const verificationOutput = fs.readFileSync(verificationOutputFile, 'utf8');

      // Parse vitest output from verification_output.txt
      const vitestMatch = verificationOutput.match(/Tests\s+(\d+)\s+failed.*?(\d+)\s+passed/s);
      if (vitestMatch) {
        metrics.failedTests = parseInt(vitestMatch[1], 10);
        metrics.passedTests = parseInt(vitestMatch[2], 10);
        metrics.totalTests = metrics.failedTests + metrics.passedTests;
      }

      // Look for flaky test indicators
      const flakyIndicators = verificationOutput.match(/flaky|retry|rerun/gi);
      if (flakyIndicators && flakyIndicators.length > 0) {
        // Extract flaky test names from output
        const flakyLines = verificationOutput.split('\n').filter(line =>
          line.toLowerCase().includes('flaky') ||
          line.toLowerCase().includes('retry') ||
          line.toLowerCase().includes('rerun')
        );

        for (const line of flakyLines.slice(0, 10)) {
          const testMatch = line.match(/['"]([^'"]+)['"]/);
          if (testMatch) {
            metrics.flakyTests.push({
              name: testMatch[1],
              suite: 'unknown',
              type: 'vitest'
            });
          }
        }
      }
    }

    // Calculate flaky rate
    if (metrics.totalTests > 0) {
      metrics.flakyRate = Math.round((metrics.flakyTests.length / metrics.totalTests) * 100 * 100) / 100;
    }
  } catch (error) {
    console.error(`Error collecting test metrics: ${error.message}`);
    // Continue with empty metrics rather than failing
  }

  return metrics;
}

async function main() {
  const [turboMetrics, testMetrics] = await Promise.all([
    collectTurboMetrics(),
    collectTestMetrics()
  ]);

  // Write turbo metrics to the output file
  fs.writeFileSync(outputPath, JSON.stringify(turboMetrics, null, 2));

  // Write test metrics to a separate file
  let testOutputPath;
  if (outputPath.includes('-turbo.json')) {
    testOutputPath = outputPath.replace('-turbo.json', '-test.json');
  } else if (outputPath.includes('turbo-metrics.json')) {
    testOutputPath = outputPath.replace('turbo-metrics.json', 'test-metrics.json');
  } else {
    testOutputPath = outputPath.replace('.json', '-test.json');
  }

  fs.writeFileSync(testOutputPath, JSON.stringify(testMetrics, null, 2));

  console.log(`Metrics collected and written to ${outputPath} and ${testOutputPath}`);
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

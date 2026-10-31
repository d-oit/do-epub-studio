#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CORPUS_DIR = resolve(ROOT, 'packages/reader-core/src/__tests__/fixtures/capability-corpus');
const CACHE_DIR = resolve(ROOT, '.cache/epubcheck');
const EPUBCHECK_VERSION = '5.4.0';
const EPUBCHECK_SHA256 = '33350c61038e71dfb3d45a76aed04bf5481e6d5500cb780f6e98db8bbd15a28c';
const EPUBCHECK_URL = `https://github.com/w3c/epubcheck/releases/download/v${EPUBCHECK_VERSION}/epubcheck-${EPUBCHECK_VERSION}.zip`;

function hasJava() {
  try {
    execFileSync('java', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function ensureEpubcheck() {
  const jarPath = join(CACHE_DIR, `epubcheck-${EPUBCHECK_VERSION}`, 'epubcheck.jar');
  if (existsSync(jarPath)) return jarPath;

  mkdirSync(CACHE_DIR, { recursive: true });
  const zipPath = join(CACHE_DIR, `epubcheck-${EPUBCHECK_VERSION}.zip`);

  if (!existsSync(zipPath)) {
    console.log(`Downloading EPUBCheck ${EPUBCHECK_VERSION}...`);
    const response = await fetch(EPUBCHECK_URL);
    if (!response.ok) throw new Error(`Failed to download EPUBCheck: HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    const actualSha = createHash('sha256').update(buffer).digest('hex');
    if (actualSha !== EPUBCHECK_SHA256) {
      throw new Error(
        `EPUBCheck checksum mismatch: expected ${EPUBCHECK_SHA256}, got ${actualSha}`,
      );
    }
    writeFileSync(zipPath, buffer);
  }

  console.log(`Extracting EPUBCheck ${EPUBCHECK_VERSION}...`);
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', CACHE_DIR]);
  if (!existsSync(jarPath)) throw new Error(`epubcheck.jar not found at ${jarPath}`);
  return jarPath;
}

async function main() {
  if (!hasJava()) {
    console.log('[SKIP] Java runtime not found. Skipping EPUBCheck CLI execution.');
    process.exit(0);
  }

  // Ensure capabilities are generated
  const generateScript = resolve(
    ROOT,
    'packages/reader-core/src/__tests__/fixtures/generate-capabilities.mjs',
  );
  execFileSync('node', [generateScript], { stdio: 'inherit' });

  const jarPath = await ensureEpubcheck();
  const files = readdirSync(CORPUS_DIR).filter((f) => f.endsWith('.epub'));
  console.log(
    `Validating ${files.length} synthetic fixtures with EPUBCheck ${EPUBCHECK_VERSION}...`,
  );

  const reports = [];
  const outDir = join(CACHE_DIR, 'reports');
  mkdirSync(outDir, { recursive: true });

  for (const file of files) {
    const epubPath = join(CORPUS_DIR, file);
    const reportPath = join(outDir, `${file}.json`);
    try {
      execFileSync('java', ['-jar', jarPath, '-j', reportPath, epubPath], {
        stdio: 'ignore',
        timeout: 30_000,
      });
    } catch {
      // EPUBCheck exits non-zero on validation warnings/errors; report JSON is still written
    }

    if (existsSync(reportPath)) {
      try {
        const report = JSON.parse(readFileSync(reportPath, 'utf8'));
        reports.push({
          file,
          messages: (report.messages || []).map((m) => ({
            id: m.id,
            severity: m.severity,
            message: m.message,
          })),
        });
      } catch {
        // Fallback for corrupt JSON
      }
    }
  }

  const summaryPath = resolve(ROOT, 'epubcheck-report.json');
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        validatorVersion: EPUBCHECK_VERSION,
        timestamp: new Date().toISOString(),
        fixtureCount: reports.length,
        reports,
      },
      null,
      2,
    ),
  );

  console.log(`Wrote aggregated EPUBCheck report to ${summaryPath}`);
}

main().catch((err) => {
  console.error(`EPUBCheck fixture validation failed: ${err.message}`);
  process.exit(1);
});

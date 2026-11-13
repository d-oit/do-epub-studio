#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function read(relPath) {
  return readFileSync(resolve(ROOT, relPath), 'utf8');
}

function extractPinnedEpubcheckVersion(source, pattern, label) {
  const match = pattern.exec(source);
  if (!match?.[1]) {
    throw new Error(`Could not determine pinned EPUBCheck version in ${label}`);
  }
  return match[1];
}

function main() {
  const matrix = read('docs/epub-capability-matrix.md');
  const adr1017 = read('plans/1017-adr-epub-conformance-and-evidence.md');
  const fixtureCheck = read('scripts/check-epub-fixtures.mjs');
  const runnerServer = read('apps/epubcheck-runner/src/server.ts');

  const fixtureVersion = extractPinnedEpubcheckVersion(
    fixtureCheck,
    /const EPUBCHECK_VERSION = '([^']+)'/,
    'scripts/check-epub-fixtures.mjs',
  );
  const runnerVersion = extractPinnedEpubcheckVersion(
    runnerServer,
    /const VERSION = '([^']+)'/,
    'apps/epubcheck-runner/src/server.ts',
  );

  const errors = [];

  if (fixtureVersion !== runnerVersion) {
    errors.push(
      `EPUBCheck version mismatch: check-epub-fixtures.mjs (${fixtureVersion}) != epubcheck-runner (${runnerVersion})`,
    );
  }

  const requiredTokens = [
    ['EPUB 3.3 URL', 'https://www.w3.org/TR/epub-33/'],
    ['EPUB 3.4 URL', 'https://www.w3.org/TR/epub-34/'],
    ['EPUB 3.4 status date', '2 November 2026'],
    ['EPUB Accessibility 1.1 URL', 'https://www.w3.org/TR/epub-a11y-11/'],
    ['EPUB Accessibility 1.2 URL', 'https://www.w3.org/TR/epub-a11y-12/'],
    ['EPUB Accessibility 1.2 status date', '12 September 2026'],
    ['EPUB Annotations 1.0 URL', 'https://www.w3.org/TR/epub-anno-10/'],
    [
      'Pinned EPUBCheck release URL',
      `https://github.com/w3c/epubcheck/releases/tag/v${fixtureVersion}`,
    ],
  ];

  for (const [label, token] of requiredTokens) {
    if (!matrix.includes(token)) {
      errors.push(`docs/epub-capability-matrix.md is missing ${label} (${token})`);
    }
    if (!adr1017.includes(token)) {
      errors.push(`plans/1017-adr-epub-conformance-and-evidence.md is missing ${label} (${token})`);
    }
  }

  if (!matrix.includes('Candidate Recommendation Draft')) {
    errors.push('docs/epub-capability-matrix.md must state Candidate Recommendation Draft status');
  }
  if (!matrix.includes('Working Draft')) {
    errors.push('docs/epub-capability-matrix.md must state Working Draft status');
  }
  if (!matrix.includes('## Review cadence')) {
    errors.push('docs/epub-capability-matrix.md must include a ## Review cadence section');
  }

  if (errors.length > 0) {
    console.error('Standards status check failed:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `✓ Standards status and pinned EPUBCheck (${fixtureVersion}) verified across docs and ADR-1017.`,
  );
}

main();

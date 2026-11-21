#!/usr/bin/env node
/**
 * Standards-status update machinery (manual/scheduled only).
 *
 * Fetches W3C publication metadata and content fingerprints for the three
 * tracked specifications:
 *   - EPUB 3.3 (https://www.w3.org/TR/epub-33/)
 *   - EPUB 3.4 (https://www.w3.org/TR/epub-34/)
 *   - EPUB Reading Systems 3.4 (https://www.w3.org/TR/epub-rs-34/)
 *
 * Modes:
 *   --snapshot (default): writes a timestamped snapshot
 *     docs/standards/w3c-status-<ISOdate>.json plus a review diff report
 *     (docs/standards/w3c-drift-report.md). Commits are always manual.
 *   --check: compares a fresh fetch against the latest committed snapshot and
 *     exits 2 when any status/content changed (report written to the output
 *     directory); exits 0 when unchanged. Used by the scheduled drift workflow.
 *   --out-dir <dir>: write report artifacts here (never the repo) — used by CI.
 *
 * Determinism: network fetches happen only when this script runs; repository
 * builds and unit tests never fetch.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SNAPSHOT_DIR = join(ROOT, 'docs/standards');
const SNAPSHOT_PREFIX = 'w3c-status-';
const REPORT_FILENAME = 'w3c-drift-report.md';
const FETCH_TIMEOUT_MS = 30_000;

const SPECS = [
  { shortName: 'epub-33', url: 'https://www.w3.org/TR/epub-33/' },
  { shortName: 'epub-34', url: 'https://www.w3.org/TR/epub-34/' },
  { shortName: 'epub-rs-34', url: 'https://www.w3.org/TR/epub-rs-34/' },
];

/** Parse CLI args. */
export function parseArgs(argv = process.argv.slice(2)) {
  const options = { mode: 'snapshot', outDir: SNAPSHOT_DIR };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--check') options.mode = 'check';
    else if (argv[i] === '--snapshot') options.mode = 'snapshot';
    else if (argv[i] === '--out-dir' && argv[i + 1]) {
      options.outDir = resolve(argv[i + 1]);
      i += 1;
    }
  }
  return options;
}

/**
 * Parse a W3C TR page into a stable status/fingerprint record.
 * @param {string} html raw page source
 * @param {string} shortName e.g. "epub-34"
 */
export function parseSpecPage(html, shortName) {
  const record = { shortName, headings: [], textHash: null };

  const configMatch = html.match(/<script[^>]*id="initialUserConfig"[^>]*>(.*?)<\/script>/s);
  if (configMatch) {
    try {
      const config = JSON.parse(configMatch[1]);
      for (const key of [
        'specStatus',
        'publishDate',
        'generatedSubtitle',
        'gitRevision',
        'crEnd',
      ]) {
        if (typeof config[key] === 'string') record[key] = config[key];
      }
    } catch {
      // Fall through to body-text extraction below.
    }
  }
  if (!record.specStatus) {
    const statusMatch = html.match(
      /W3C ((?:Candidate Recommendation Draft|Recommendation|Working Draft|Proposed Recommendation|Candidate Recommendation Snapshot|Note))/,
    );
    if (statusMatch) record.specStatus = statusMatch[1];
  }
  if (!record.generatedSubtitle) {
    const titleMatch = html.match(/>W3C .*?(\d{1,2} \w+ \d{4})</);
    if (titleMatch)
      record.generatedSubtitle = `W3C ${record.specStatus ?? ''} ${titleMatch[1]}`.trim();
  }

  for (const match of html.matchAll(/<h([23])[^>]*id="([^"]+)"[^>]*>(.*?)<\/h\1>/gs)) {
    const [, level, id, titleHtml] = match;
    const title = titleHtml
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    record.headings.push({ level: Number(level), id, title });
  }

  const text = sanitizeFingerprintText(html);
  record.textHash = createHash('sha256').update(text).digest('hex');
  return record;
}

const STRIP_TOKENS = ['<script', '</script', '<style', '</style'];

/**
 * Normalize visible text for fingerprinting: drop script/style markup tokens
 * (case-insensitively, including unclosed or attribute-bearing forms), then
 * strip remaining tags and collapse whitespace. Used only for the content
 * fingerprint; the raw page source is never returned.
 * @param {string} source raw page source
 */
export function sanitizeFingerprintText(source) {
  const lower = source.toLowerCase();
  let out = '';
  let cursor = 0;
  while (cursor < source.length) {
    let earliest = -1;
    let chosen = '';
    for (const token of STRIP_TOKENS) {
      const pos = lower.indexOf(token, cursor);
      if (pos !== -1 && (earliest === -1 || pos < earliest)) {
        earliest = pos;
        chosen = token;
      }
    }
    if (earliest === -1) {
      out += source.slice(cursor);
      break;
    }
    out += `${source.slice(cursor, earliest)} `;
    cursor = earliest + chosen.length;
  }
  return out
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export async function fetchSpecPage(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with HTTP ${response.status}`);
  }
  return response.text();
}

/** Build a full snapshot record for all three specs. */
export async function buildSnapshot(fetchPage = fetchSpecPage) {
  const specs = {};
  for (const { shortName, url } of SPECS) {
    specs[shortName] = parseSpecPage(await fetchPage(url), shortName);
  }
  return { generatedAt: new Date().toISOString(), specs };
}

/** Path of the newest existing snapshot in `dir` (or null). */
export function latestSnapshotPath(dir = SNAPSHOT_DIR) {
  const files = readdirSync(dir)
    .filter((file) => file.startsWith(SNAPSHOT_PREFIX) && file.endsWith('.json'))
    .sort();
  return files.length > 0 ? join(dir, files[files.length - 1]) : null;
}

/** Load a snapshot (or null when missing/invalid). */
export function loadSnapshot(file) {
  if (!file) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const COMPARED_FIELDS = ['specStatus', 'publishDate', 'generatedSubtitle', 'gitRevision', 'crEnd'];

/**
 * Diff two snapshots. Returns { changed: boolean, entries: string[] }.
 */
export function compareSnapshots(previous, current) {
  const entries = [];
  if (!previous) {
    entries.push('No previous snapshot found — first tracked baseline.');
    return { changed: true, entries };
  }
  for (const [shortName, currentSpec] of Object.entries(current.specs ?? {})) {
    const prevSpec = previous.specs?.[shortName];
    if (!prevSpec) {
      entries.push(`- Newly tracked spec: ${shortName}`);
      continue;
    }
    for (const field of COMPARED_FIELDS) {
      const before = prevSpec[field] ?? '(absent)';
      const after = currentSpec[field] ?? '(absent)';
      if (before !== after) {
        entries.push(`- ${shortName} ${field}: ${before} → ${after}`);
      }
    }
    const prevHeadings = new Map((prevSpec.headings ?? []).map((h) => [h.id, h.title]));
    const currentHeadings = new Map((currentSpec.headings ?? []).map((h) => [h.id, h.title]));
    for (const [id, title] of currentHeadings) {
      if (!prevHeadings.has(id)) {
        entries.push(`- ${shortName} new clause heading [${id}] ${title}`);
      } else if (prevHeadings.get(id) !== title) {
        entries.push(
          `- ${shortName} clause heading reworded [${id}]: “${prevHeadings.get(id)}” → “${title}”`,
        );
      }
    }
    for (const id of prevHeadings.keys()) {
      if (!currentHeadings.has(id)) {
        entries.push(`- ${shortName} dropped clause heading [${id}] ${prevHeadings.get(id)}`);
      }
    }
    if (prevSpec.textHash && currentSpec.textHash && prevSpec.textHash !== currentSpec.textHash) {
      entries.push(`- ${shortName} visible-text fingerprint changed (content edit detected)`);
    }
  }
  return { changed: entries.length > 0, entries };
}

/** Render the review diff report as markdown. */
export function renderReport(current, result, reportUrl) {
  const statusLines = Object.entries(current.specs ?? {})
    .map(
      ([name, spec]) =>
        `- **${name}**: ${spec.generatedSubtitle ?? spec.specStatus ?? 'unknown'} (git ${spec.gitRevision ?? 'n/a'})`,
    )
    .join('\n');
  const body = result.entries.length > 0 ? result.entries.join('\n') : 'No changes detected.';
  return [
    '# W3C Standards Drift Review',
    '',
    `Generated: ${current.generatedAt}`,
    '',
    '## Current tracked status',
    '',
    statusLines,
    '',
    '## Changes vs previous snapshot',
    '',
    body,
    '',
    '> This report is generated by `scripts/standards-status-update.mjs`. Review and commit',
    '> any new `docs/standards/w3c-status-*.json` snapshots manually. The scheduled workflow',
    '> never modifies code and never opens pull requests.',
    '',
  ].join('\n');
}

/** Write a timestamped snapshot file; returns its path. */
export function writeSnapshot(snapshot, dir = SNAPSHOT_DIR) {
  mkdirSync(dir, { recursive: true });
  const date = snapshot.generatedAt.slice(0, 10);
  const file = join(dir, `${SNAPSHOT_PREFIX}${date}.json`);
  writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return file;
}

/** Write the review report; returns its path. */
export function writeReport(report, dir = SNAPSHOT_DIR) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, REPORT_FILENAME);
  writeFileSync(file, report, 'utf8');
  return file;
}

/** Main entry point. */
export async function main(argv = process.argv.slice(2)) {
  const { mode, outDir } = parseArgs(argv);

  let snapshot;
  try {
    snapshot = await buildSnapshot();
  } catch (error) {
    console.error(`✗ Failed to fetch W3C status: ${error.message}`);
    process.exit(1);
  }

  const baselineFile = latestSnapshotPath(SNAPSHOT_DIR);
  const baseline = loadSnapshot(baselineFile);
  const result = compareSnapshots(baseline, snapshot);
  const report = renderReport(snapshot, result, undefined);

  if (mode === 'check') {
    writeReport(report, outDir);
    if (result.changed) {
      console.error('✗ W3C standards drift detected (see drift report).');
      process.exit(2);
    }
    console.log('✓ No W3C standards drift since the last snapshot.');
    return;
  }

  const snapshotFile = writeSnapshot(snapshot);
  const reportFile = writeReport(report, outDir);
  console.log(`✓ Wrote snapshot ${snapshotFile}`);
  console.log(`✓ Wrote drift report ${reportFile}`);
  if (result.changed) {
    console.log('  Changes detected — review the report and commit the snapshot manually.');
  } else {
    console.log('  No changes vs the previous snapshot.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

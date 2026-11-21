#!/usr/bin/env -S pnpm exec tsx
/**
 * Differential corpus job (issue #1483): reader-core diagnostics vs
 * EPUBCheck for the shared corpus manifest.
 *
 * NOT run in unit tests. Requires either:
 *   - EPUBCHECK_RUNNER_URL  (POST /validate — the deployed runner), or
 *   - EPUBCHECK_JAR         (path to a local epubcheck.jar, needs java)
 *
 * Disagreements are *not* silent expected failures: every code family we know
 * the validators diverge on must be triaged in `known-diffs.ts` (with a
 * rationale). Any untriaged error-level EPUBCheck finding on a fixture whose
 * archive passes validation fails this job.
 *
 * Usage: EPUBCHECK_RUNNER_URL=... pnpm exec tsx scripts/diff-corpus-epubcheck.mts
 */
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CORPUS_ENTRIES,
  generateCorpusEntry,
  KNOWN_DIFFS,
} from '@do-epub-studio/testkit';

interface RunnerFinding {
  severity: string;
  code: string;
  message: string;
}

interface RunnerResult {
  safetyStatus: string;
  conformanceStatus: string;
  findings: RunnerFinding[];
}

async function runViaJar(bytes: Uint8Array, jar: string): Promise<RunnerResult> {
  const workDir = await mkdtemp(join(tmpdir(), 'corpus-diff-'));
  try {
    const inputPath = join(workDir, 'input.epub');
    const reportPath = join(workDir, 'epubcheck-report.json');
    await writeFile(inputPath, bytes);
    await new Promise<void>((resolve, reject) => {
      const child = spawn('java', ['-Xmx512m', '-jar', jar, '-j', reportPath, inputPath]);
      const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
      child.on('error', reject);
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== null && code !== 0 && code !== 1) reject(new Error(`epubcheck exit ${code}`));
        else resolve();
      });
    });
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    const findings: RunnerFinding[] = (report.messages ?? []).map((m: { id?: string; severity?: string; message?: string }) => ({
      severity: (m.severity ?? '').toUpperCase(),
      code: m.id ?? 'EPUBCHECK',
      message: m.message ?? '',
    }));
    return { safetyStatus: 'accepted', conformanceStatus: 'completed', findings };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function runViaHttp(bytes: Uint8Array, url: string): Promise<RunnerResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: bytes,
  });
  if (response.status === 422) {
    const body = (await response.json()) as { safetyStatus?: string; failureCode?: string };
    return { safetyStatus: body.safetyStatus ?? 'rejected', conformanceStatus: 'rejected', findings: [] };
  }
  if (!response.ok) {
    throw new Error(`runner returned ${response.status}`);
  }
  const body = (await response.json()) as RunnerResult;
  return body;
}

async function main(): Promise<number> {
  const runnerUrl = process.env.EPUBCHECK_RUNNER_URL;
  const jar = process.env.EPUBCHECK_JAR;
  if (!runnerUrl && !jar) {
    console.error('Set EPUBCHECK_RUNNER_URL or EPUBCHECK_JAR to run the differential job.');
    return 2;
  }

  const triaged = new Map<string, Set<string>>();
  for (const diff of KNOWN_DIFFS) {
    const set = triaged.get(diff.fixtureId) ?? new Set();
    set.add(diff.epubcheckCode);
    triaged.set(diff.fixtureId, set);
  }

  let failures = 0;
  const rows: unknown[] = [];
  for (const entry of CORPUS_ENTRIES) {
    const bytes = generateCorpusEntry(entry.id);
    let result: RunnerResult;
    try {
      result = jar ? await runViaJar(bytes, jar) : await runViaHttp(bytes, runnerUrl!);
    } catch (error) {
      console.error(`  [RUNNER FAILURE] ${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
      failures += 1;
      continue;
    }
    if (result.safetyStatus === 'rejected') {
      // Archive-level rejection before EPUBCheck — matches our expectedArchive
      // when the manifest says reject. This is an expected pipeline gate, not
      // a "disagreement" with EPUBCheck.
      const expectsReject = entry.expectedArchive.kind === 'reject';
      rows.push({
        fixture: entry.id,
        verdict: expectsReject ? 'rejected-as-expected' : 'REJECTED-UNEXPECTED',
        triaged: [],
        epubcheckErrors: [],
        expectedErrors: entry.expectedDiagnostics.filter((d) => d.severity === 'error').map((d) => d.code),
      });
      if (!expectsReject) failures += 1;
      continue;
    }

    const errors = result.findings
      .filter((f) => f.severity === 'ERROR' || f.severity === 'FATAL')
      .map((f) => f.code);
    const mined = triaged.get(entry.id) ?? new Set();
    const untriaged = errors.filter((code) => !mined.has(code));
    const expectedErrors = entry.expectedDiagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => d.code);

    rows.push({
      fixture: entry.id,
      verdict: untriaged.length === 0 ? 'ok' : 'UNTRIAGED-DISAGREEMENT',
      untriagedEpubcheckErrors: untriaged,
      triaged: errors.filter((code) => mined.has(code)),
      epubcheckErrors: errors,
      expectedErrors,
    });
    if (untriaged.length > 0) failures += 1;
  }

  console.log(JSON.stringify({ ranAt: new Date().toISOString(), failures, rows }, null, 2));
  return failures === 0 ? 0 : 1;
}

process.exit(await main());

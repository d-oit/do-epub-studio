import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validateArchive,
  ArchiveRejectionError,
} from '../../../packages/shared/src/archive-validator';
import { assessAccessibility } from '@do-epub-studio/reader-core/accessibility';
import {
  EpubExtractionError,
  extractEpubContainerContext,
  extractEpubVersion,
  extractOpfFromZip,
  metadataFromOpf,
  parseFindings,
  parseJsonReport,
} from './epubcheck-parsing';

const PORT = Number(process.env.PORT ?? 8080);
const MAX_INPUT_BYTES = 100 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_REPORT_BYTES = 256 * 1024;
const MAX_RUNTIME_MS = 120_000;
const VERSION = '5.4.0';
const TOKEN = process.env.EPUBCHECK_RUNNER_TOKEN ?? '';

interface RunnerAccessibilityFinding {
  severity: string;
  code: string;
  location: string | null;
  path: string | null;
  message: string;
}

interface RunnerAccessibilityEvidence {
  spec: string;
  specUrl: string;
  version: string;
  status: string;
  statusDate: string;
  clause: string;
  checkId: string;
  result: string;
  evidence: string;
  limitation: string;
}

interface RunnerAccessibilitySpecRef {
  spec: string;
  specUrl: string;
  version: string;
  status: string;
  statusDate: string;
}

interface RunnerAccessibilityProfile {
  spec: RunnerAccessibilitySpecRef | null;
  experimental: boolean;
  certification: 'declared' | 'not-certified';
  findings: RunnerAccessibilityFinding[];
  evidence: RunnerAccessibilityEvidence[];
}

interface RunnerAccessibilityReport {
  metadata: Array<{ key: string; value: string; provenance: 'opf' }>;
  advisories: Array<{ category: string; message: string; source: string }>;
  manualReviewRequired: boolean;
  certification: 'declared' | 'not-certified';
  profiles: {
    '1.1': RunnerAccessibilityProfile;
    '1.2-draft': RunnerAccessibilityProfile;
  };
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

function send(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

async function spool(request: IncomingMessage, target: string): Promise<string> {
  const file = await open(target, 'wx', 0o600);
  const hash = createHash('sha256');
  let bytes = 0;
  try {
    for await (const raw of request) {
      const chunk = raw as Buffer;
      bytes += chunk.byteLength;
      if (bytes > MAX_INPUT_BYTES) throw new Error('input_limit');
      hash.update(chunk);
      await file.writeFile(chunk);
    }
  } finally {
    await file.close();
  }
  if (bytes === 0) throw new Error('empty_input');
  return hash.digest('hex');
}

const ADVISORIES: Array<{ category: string; message: string; source: string }> = [
  [
    'language',
    'Confirm language declarations match the publication and its passages.',
    'manual-review',
  ],
  ['headings', 'Review heading hierarchy and meaningful section structure.', 'manual-review'],
  ['navigation-labels', 'Review navigation labels for clarity and context.', 'manual-review'],
  [
    'image-alternatives',
    'Review image alternatives for equivalent meaning and decorative images.',
    'manual-review',
  ],
  ['tables', 'Review table headers, relationships, and reading order.', 'manual-review'],
  ['landmarks', 'Review landmark navigation and semantic roles.', 'manual-review'],
  [
    'media',
    'Review captions, transcripts, and audio descriptions where applicable.',
    'manual-review',
  ],
].map(([category, message, source]) => ({ category, message, source }));

export async function executeEpubcheck(
  inputPath: string,
  workDir: string,
  timeoutMs = MAX_RUNTIME_MS,
): Promise<{ output: string; code: number }> {
  const { promise, resolve, reject } = Promise.withResolvers<{ output: string; code: number }>();
  const reportPath = join(workDir, 'epubcheck-report.json');
  const jarPath = process.env.EPUBCHECK_JAR_PATH ?? '/opt/epubcheck/epubcheck.jar';
  const javaCommand = process.env.EPUBCHECK_JAVA_BIN ?? 'java';
  const child = spawn(javaCommand, ['-Xmx512m', '-jar', jarPath, '-j', reportPath, inputPath], {
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
  });
  let output = '';
  let outputBytes = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, timeoutMs);
  function capture(chunk: Buffer): void {
    outputBytes += chunk.byteLength;
    if (outputBytes > MAX_OUTPUT_BYTES) child.kill('SIGKILL');
    else output += chunk.toString('utf8');
  }
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  child.once('error', (error) => reject(error));
  child.once('close', (code) => {
    clearTimeout(timer);
    if (outputBytes > MAX_OUTPUT_BYTES) reject(new Error('diagnostics_limit'));
    else if (timedOut) reject(new Error('validator_timeout'));
    else if (code === null) reject(new Error('validator_terminated'));
    else resolve({ output, code });
  });
  return promise;
}

async function validate(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const authorization = request.headers.authorization ?? '';
  if (!TOKEN || !safeEqual(authorization, `Bearer ${TOKEN}`))
    return send(response, 401, { error: 'unauthorized' });
  const declared = Number(request.headers['content-length'] ?? 0);
  if (declared > MAX_INPUT_BYTES) return send(response, 413, { error: 'input_limit' });
  const workDir = await mkdtemp(join(tmpdir(), 'epubcheck-'));
  try {
    const inputPath = join(workDir, 'input.epub');
    const sha256 = await spool(request, inputPath);
    const bytes = await readFile(inputPath);
    try {
      await validateArchive(bytes);
    } catch (error) {
      const code = error instanceof ArchiveRejectionError ? error.code : 'invalid-archive';
      return send(response, 422, {
        safetyStatus: 'rejected',
        failureCode: `ARCHIVE_${code.toUpperCase().replace('-', '_')}`,
        validatorVersion: VERSION,
        sha256,
      });
    }
    const result = await executeEpubcheck(inputPath, workDir);
    let opf: string | null = null;
    let epubVersion: string | null = null;
    let extraction: { opf: string | null; opfPath: string | null } | null = null;
    try {
      extraction = extractOpfFromZip(bytes);
      opf = extraction.opf;
      if (opf) {
        epubVersion = extractEpubVersion(opf);
      }
    } catch (error) {
      if (error instanceof EpubExtractionError) {
        const status =
          error.code === 'OPF_TOO_LARGE' || error.code === 'CONTAINER_TOO_LARGE' ? 413 : 422;
        return send(response, status, {
          error: error.code.toLowerCase(),
          message: error.message,
        });
      }
      throw error;
    }
    const reportPath = join(workDir, 'epubcheck-report.json');
    let findings = parseFindings(result.output);
    try {
      const report = await readFile(reportPath);
      if (report.byteLength <= MAX_REPORT_BYTES) {
        const jsonFindings = parseJsonReport(report.toString('utf8'));
        if (jsonFindings.length > 0 || result.output.length === 0) {
          findings = jsonFindings;
        }
      }
    } catch {
      /* EPUBCheck stdout remains the bounded fallback source. */
    }

    let accessibility: RunnerAccessibilityReport;
    if (opf && extraction) {
      const context = extractEpubContainerContext(bytes, opf, extraction.opfPath ?? '');
      const a11y11 = assessAccessibility({ opfXml: opf, context }, { specProfile: '1.1' });
      const a11y12 = assessAccessibility({ opfXml: opf, context }, { specProfile: '1.2-draft' });
      accessibility = {
        metadata: metadataFromOpf(opf),
        advisories: [...ADVISORIES],
        manualReviewRequired: true,
        certification: a11y11.certification,
        profiles: {
          '1.1': {
            spec: a11y11.spec,
            experimental: false,
            certification: a11y11.certification,
            findings: a11y11.findings,
            evidence: a11y11.evidence,
          },
          '1.2-draft': {
            spec: a11y12.spec,
            experimental: true,
            certification: 'not-certified',
            findings: a11y12.findings,
            evidence: a11y12.evidence,
          },
        },
      };
    } else {
      accessibility = {
        metadata: [],
        advisories: [...ADVISORIES],
        manualReviewRequired: true,
        certification: 'not-certified',
        profiles: {
          '1.1': {
            spec: null,
            experimental: false,
            certification: 'not-certified',
            findings: [],
            evidence: [],
          },
          '1.2-draft': {
            spec: null,
            experimental: true,
            certification: 'not-certified',
            findings: [],
            evidence: [],
          },
        },
      };
    }

    if (result.code !== 0 && !findings.some((finding) => finding.severity === 'error')) {
      return send(response, 503, { error: 'runner_unavailable' });
    }
    send(response, 200, {
      validatorVersion: VERSION,
      sha256,
      epubVersion,
      findings,
      accessibility,
      safetyStatus: 'accepted',
      conformanceStatus: result.code === 0 ? 'completed' : 'failed',
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'runner_failure';
    const status =
      code === 'input_limit'
        ? 413
        : code === 'empty_input'
          ? 400
          : code === 'validator_timeout'
            ? 504
            : 503;
    send(response, status, { error: status === 503 ? 'runner_unavailable' : code });
  } finally {
    await rm(workDir, { recursive: true, force: true, maxRetries: 2 });
  }
}
const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health')
    return send(response, 200, { validatorVersion: VERSION });
  if (request.method === 'POST' && request.url === '/validate')
    return void validate(request, response);
  send(response, 404, { error: 'not_found' });
});

if (
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))
) {
  server.listen(PORT, '0.0.0.0');
}

export { server, validate };

export {
  EpubExtractionError,
  extractEpubContainerContext,
  extractEpubVersion,
  extractOpfFromZip,
  extractRootfilePath,
  metadataFromOpf,
  normalizeFindingPath,
  parseFindings,
  parseJsonReport,
  validateRootfilePath,
} from './epubcheck-parsing';

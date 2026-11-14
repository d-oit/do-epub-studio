import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateArchive } from '../../../packages/shared/src/archive-validator';
import {
  EpubExtractionError,
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
      await file.write(chunk);
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
  [
    'reader-ui',
    'Reader UI accessibility is evaluated separately from publication metadata.',
    'reader-ui',
  ],
].map(([category, message, source]) => ({ category, message, source }));

async function executeEpubcheck(
  inputPath: string,
  workDir: string,
): Promise<{ output: string; code: number }> {
  const { promise, resolve, reject } = Promise.withResolvers<{ output: string; code: number }>();
  const reportPath = join(workDir, 'epubcheck-report.json');
  const child = spawn(
    'java',
    ['-Xmx512m', '-jar', '/opt/epubcheck/epubcheck.jar', '-j', reportPath, inputPath],
    {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
    },
  );
  let output = '';
  let outputBytes = 0;
  const timer = setTimeout(() => child.kill('SIGKILL'), MAX_RUNTIME_MS);
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
    } catch {
      return send(response, 422, {
        safetyStatus: 'rejected',
        failureCode: 'ARCHIVE_SAFETY_REJECTED',
        validatorVersion: VERSION,
        sha256,
      });
    }
    const result = await executeEpubcheck(inputPath, workDir);
    let opf: string | null = null;
    let epubVersion: string | null = null;
    try {
      const extraction = extractOpfFromZip(bytes);
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
    send(response, 200, {
      validatorVersion: VERSION,
      sha256,
      epubVersion,
      findings,
      accessibility: {
        metadata: opf ? metadataFromOpf(opf) : [],
        advisories: [...ADVISORIES],
        manualReviewRequired: true,
        certification: 'not-certified',
      },
      safetyStatus: 'accepted',
      conformanceStatus: result.code === 0 ? 'completed' : 'failed',
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'runner_failure';
    const status = code === 'input_limit' ? 413 : code === 'empty_input' ? 400 : 503;
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
  extractEpubVersion,
  extractOpfFromZip,
  extractRootfilePath,
  metadataFromOpf,
  normalizeFindingPath,
  parseFindings,
  parseJsonReport,
  validateRootfilePath,
} from './epubcheck-parsing';

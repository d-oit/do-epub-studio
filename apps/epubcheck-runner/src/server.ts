import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateArchive } from '../../../packages/shared/src/archive-validator';

const PORT = Number(process.env.PORT ?? 8080);
const MAX_INPUT_BYTES = 100 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_REPORT_BYTES = 256 * 1024;
const MAX_RUNTIME_MS = 120_000;
const VERSION = '5.4.0';
const TOKEN = process.env.EPUBCHECK_RUNNER_TOKEN ?? '';

interface Finding {
  severity: 'error' | 'warning' | 'info';
  code: string;
  location: string | null;
  path: string | null;
  message: string;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

function send(response: import('node:http').ServerResponse, status: number, body: object): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

async function spool(
  request: import('node:http').IncomingMessage,
  target: string,
): Promise<string> {
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

function parseFindings(output: string): Finding[] {
  const findings: Finding[] = [];
  for (const line of output.split('\n').slice(0, 1000)) {
    const severity = line.includes('ERROR')
      ? 'error'
      : line.includes('WARNING')
        ? 'warning'
        : line.includes('INFO')
          ? 'info'
          : null;
    if (!severity) continue;
    const codeMatch =
      line.match(/\b(?:ERROR|WARNING|INFO)\(([^)]+)\):/) ??
      line.match(/\b(?:ERROR|WARNING|INFO)\b[:\s]+([A-Z0-9_-]+)/);
    const code = codeMatch && codeMatch[1] ? codeMatch[1].slice(0, 80) : 'EPUBCHECK';
    const start = line.indexOf(']');
    const text = (start >= 0 ? line.slice(start + 1) : line).trim().slice(0, 500);
    findings.push({
      severity,
      code,
      location: null,
      path: null,
      message: text.slice(0, 500) || 'EPUBCheck reported a finding',
    });
    if (findings.length >= 1000) break;
  }
  return findings;
}
const XML_ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&',
};

function decodeXml(str: string): string {
  return str.replace(/&(?:lt|gt|quot|apos|amp);/g, (entity) => XML_ENTITIES[entity] ?? entity);
}

function metadataFromOpf(opf: string): Array<{ key: string; value: string; provenance: 'opf' }> {
  const metadata: Array<{ key: string; value: string; provenance: 'opf' }> = [];
  for (const key of [
    'dc:language',
    'schema:accessMode',
    'schema:accessModeSufficient',
    'schema:accessibilityFeature',
    'schema:accessibilityHazard',
    'schema:accessibilitySummary',
  ]) {
    const open = `<${key}`;
    const begin = opf.indexOf(open);
    if (begin < 0) continue;
    const content = opf.indexOf('>', begin);
    const end = content < 0 ? -1 : opf.indexOf(`</${key}>`, content + 1);
    if (content < 0 || end < 0) continue;
    const value = decodeXml(opf.slice(content + 1, end))
      .trim()
      .slice(0, 300);
    metadata.push({ key, value, provenance: 'opf' });
  }
  return metadata;
}

function advisories(): Array<{ category: string; message: string; source: string }> {
  return [
    {
      category: 'language',
      message: 'Confirm language declarations match the publication and its passages.',
      source: 'manual-review',
    },
    {
      category: 'headings',
      message: 'Review heading hierarchy and meaningful section structure.',
      source: 'manual-review',
    },
    {
      category: 'navigation-labels',
      message: 'Review navigation labels for clarity and context.',
      source: 'manual-review',
    },
    {
      category: 'image-alternatives',
      message: 'Review image alternatives for equivalent meaning and decorative images.',
      source: 'manual-review',
    },
    {
      category: 'tables',
      message: 'Review table headers, relationships, and reading order.',
      source: 'manual-review',
    },
    {
      category: 'landmarks',
      message: 'Review landmark navigation and semantic roles.',
      source: 'manual-review',
    },
    {
      category: 'media',
      message: 'Review captions, transcripts, and audio descriptions where applicable.',
      source: 'manual-review',
    },
    {
      category: 'reader-ui',
      message: 'Reader UI accessibility is evaluated separately from publication metadata.',
      source: 'reader-ui',
    },
  ];
}

async function executeEpubcheck(
  inputPath: string,
  workDir: string,
): Promise<{ output: string; code: number }> {
  const { promise, resolve, reject } = Promise.withResolvers<{ output: string; code: number }>();
  const reportPath = join(workDir, 'epubcheck-report.json');
  const child = spawn(
    'java',
    ['-Xmx512m', '-jar', '/opt/epubcheck/epubcheck.jar', '-j', '-o', reportPath, inputPath],
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

async function validate(
  request: import('node:http').IncomingMessage,
  response: import('node:http').ServerResponse,
): Promise<void> {
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
    let opf = '';
    // Only metadata extracted by the EPUB parser is returned; archive paths are never disclosed.
    const container = bytes.indexOf(Buffer.from('META-INF/container.xml'));
    if (container >= 0) opf = '';
    const reportPath = join(workDir, 'epubcheck-report.json');
    let findings = parseFindings(result.output);
    try {
      const report = await readFile(reportPath);
      if (report.byteLength <= MAX_REPORT_BYTES) {
        const parsed = JSON.parse(report.toString('utf8')) as {
          messages?: Array<{ severity?: string; id?: string; message?: string }>;
        };
        if (Array.isArray(parsed.messages))
          findings = parsed.messages.slice(0, 1000).map((item) => ({
            severity:
              item.severity === 'ERROR'
                ? 'error'
                : item.severity === 'WARNING'
                  ? 'warning'
                  : 'info',
            code: (item.id ?? 'EPUBCHECK').slice(0, 80),
            location: null,
            path: null,
            message: (item.message ?? 'EPUBCheck finding').replaceAll('\n', ' ').slice(0, 500),
          }));
      }
    } catch {
      /* EPUBCheck stdout remains the bounded fallback source. */
    }
    const epubVersion = null;
    send(response, 200, {
      validatorVersion: VERSION,
      sha256,
      epubVersion,
      findings,
      accessibility: {
        metadata: metadataFromOpf(opf),
        advisories: advisories(),
        manualReviewRequired: true,
        certification: 'not-certified',
      },
      safetyStatus: 'accepted',
      conformanceStatus: result.code === 0 ? 'completed' : 'completed',
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

export { server, validate, parseFindings, metadataFromOpf };

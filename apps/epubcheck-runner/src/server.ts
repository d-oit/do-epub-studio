import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateArchive } from '../../../packages/shared/src/archive-validator';
import { unzipSync, strFromU8 } from 'fflate';

const PORT = Number(process.env.PORT ?? 8080);
const MAX_INPUT_BYTES = 100 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_REPORT_BYTES = 256 * 1024;
const MAX_CONTAINER_BYTES = 64 * 1024;
const MAX_OPF_BYTES = 2 * 1024 * 1024;
const MAX_RUNTIME_MS = 120_000;
const VERSION = '5.4.0';
const TOKEN = process.env.EPUBCHECK_RUNNER_TOKEN ?? '';

export class EpubExtractionError extends Error {
  constructor(
    readonly code:
      'INVALID_PACKAGE_PATH' | 'CONTAINER_TOO_LARGE' | 'OPF_TOO_LARGE' | 'CORRUPT_ARCHIVE',
    message: string,
  ) {
    super(message);
    this.name = 'EpubExtractionError';
  }
}

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

const TARGET_PROPERTIES_SET = new Set([
  'dc:language',
  'schema:accessMode',
  'schema:accessModeSufficient',
  'schema:accessibilityFeature',
  'schema:accessibilityHazard',
  'schema:accessibilitySummary',
  'schema:accessibilityControl',
  'schema:accessibilityAPI',
  'dcterms:conformsTo',
  'a11y:certifiedBy',
  'a11y:certifierCredential',
  'a11y:certifierReport',
]);

const META_TAG_REGEX = /<meta\b([^>]*?)(?:>([^<]*)<\/meta>|\/?>)/gi;
const DC_LANG_REGEX = /<dc:language\b[^>]*>([^<]*)<\/dc:language>/gi;
const LEGACY_ELEM_REGEX = /<(schema:[a-zA-Z]+)\b[^>]*>([^<]*)<\/\1>/gi;
const PROP_REGEX = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i;
const CONTENT_REGEX = /\bcontent\s*=\s*["']([^"']*)["']/i;

function validateRootfilePath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed)
    throw new EpubExtractionError('INVALID_PACKAGE_PATH', 'Rootfile path cannot be empty');
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\') ||
    /^[a-zA-Z]:/.test(trimmed) ||
    trimmed.includes('\\')
  ) {
    throw new EpubExtractionError(
      'INVALID_PACKAGE_PATH',
      'Rootfile path must be relative and cannot contain backslashes',
    );
  }
  const segments = trimmed.split('/');
  for (const seg of segments) {
    if (seg === '..' || seg === '.' || !seg) {
      throw new EpubExtractionError(
        'INVALID_PACKAGE_PATH',
        'Rootfile path contains invalid segments',
      );
    }
  }
  return segments.join('/');
}

function extractRootfilePath(containerXml: string): string | null {
  const rootfileMatches = containerXml.matchAll(/<rootfile\b([^>]*)\/?>/gi);
  let fallback: string | null = null;
  for (const match of rootfileMatches) {
    const attrs = match[1] ?? '';
    const fullPathMatch = attrs.match(/\bfull-path\s*=\s*["']([^"']+)["']/i);
    const mediaTypeMatch = attrs.match(/\bmedia-type\s*=\s*["']([^"']+)["']/i);
    if (fullPathMatch) {
      const path = fullPathMatch[1];
      if (mediaTypeMatch && mediaTypeMatch[1]?.toLowerCase() === 'application/oebps-package+xml') {
        return path;
      }
      if (!fallback) fallback = path;
    }
  }
  return fallback;
}

function extractOpfFromZip(bytes: Uint8Array): {
  opf: string | null;
  opfPath: string | null;
} {
  let unzippedContainer: Record<string, Uint8Array>;
  try {
    unzippedContainer = unzipSync(bytes, {
      filter: (file) => file.name === 'META-INF/container.xml',
    });
  } catch {
    throw new EpubExtractionError('CORRUPT_ARCHIVE', 'Failed to read container.xml from archive');
  }

  const containerBytes = unzippedContainer['META-INF/container.xml'];
  if (!containerBytes) return { opf: null, opfPath: null };
  if (containerBytes.byteLength > MAX_CONTAINER_BYTES) {
    throw new EpubExtractionError(
      'CONTAINER_TOO_LARGE',
      'META-INF/container.xml exceeds size limit',
    );
  }

  const containerXml = strFromU8(containerBytes);
  const rawRootfilePath = extractRootfilePath(containerXml);
  if (!rawRootfilePath) return { opf: null, opfPath: null };

  const normalizedOpfPath = validateRootfilePath(rawRootfilePath);

  let unzippedOpf: Record<string, Uint8Array>;
  try {
    unzippedOpf = unzipSync(bytes, {
      filter: (file) => {
        if (file.name === normalizedOpfPath) {
          if (file.originalSize && file.originalSize > MAX_OPF_BYTES) {
            throw new EpubExtractionError('OPF_TOO_LARGE', 'Package document exceeds size limit');
          }
          return true;
        }
        return false;
      },
    });
  } catch (error) {
    if (error instanceof EpubExtractionError) throw error;
    throw new EpubExtractionError(
      'CORRUPT_ARCHIVE',
      'Failed to extract package document from archive',
    );
  }

  const opfBytes = unzippedOpf[normalizedOpfPath];
  if (!opfBytes) return { opf: null, opfPath: normalizedOpfPath };
  if (opfBytes.byteLength > MAX_OPF_BYTES) {
    throw new EpubExtractionError('OPF_TOO_LARGE', 'Package document exceeds size limit');
  }

  return { opf: strFromU8(opfBytes), opfPath: normalizedOpfPath };
}

function extractEpubVersion(opf: string): string | null {
  const packageMatch = opf.match(/<package\b([^>]*)>/i);
  if (!packageMatch) return null;
  const attrs = packageMatch[1] ?? '';
  const versionMatch = attrs.match(/\bversion\s*=\s*["']([^"']+)["']/i);
  if (!versionMatch) return null;
  const version = versionMatch[1]?.trim();
  return version ? version.slice(0, 10) : null;
}

function metadataFromOpf(opf: string): Array<{ key: string; value: string; provenance: 'opf' }> {
  if (!opf || opf.length > MAX_OPF_BYTES) return [];
  const metadata: Array<{ key: string; value: string; provenance: 'opf' }> = [];
  const seen = new Set<string>();

  function add(key: string, rawVal: string) {
    if (metadata.length >= 100) return;
    const value = decodeXml(rawVal).trim().slice(0, 500);
    if (!value) return;
    const dedupeKey = `${key}:::${value}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    metadata.push({ key, value, provenance: 'opf' });
  }

  for (const match of opf.matchAll(DC_LANG_REGEX)) {
    if (match[1]) add('dc:language', match[1]);
  }
  for (const match of opf.matchAll(LEGACY_ELEM_REGEX)) {
    if (match[1] && match[2] && TARGET_PROPERTIES_SET.has(match[1])) {
      add(match[1], match[2]);
    }
  }
  for (const match of opf.matchAll(META_TAG_REGEX)) {
    const attrs = match[1] ?? '';
    const child = match[2];
    const propMatch = attrs.match(PROP_REGEX);
    if (propMatch && TARGET_PROPERTIES_SET.has(propMatch[1])) {
      let val = child ? child.trim() : null;
      if (!val) {
        const contentMatch = attrs.match(CONTENT_REGEX);
        if (contentMatch) val = contentMatch[1].trim();
      }
      if (val) add(propMatch[1], val);
    }
  }
  return metadata;
}

const ADVISORIES: ReadonlyArray<{ category: string; message: string; source: string }> = [
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

export {
  server,
  validate,
  parseFindings,
  metadataFromOpf,
  extractOpfFromZip,
  extractRootfilePath,
  validateRootfilePath,
  extractEpubVersion,
};

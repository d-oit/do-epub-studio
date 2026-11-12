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

function stripControlChars(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 32 && code !== 127) out += str[i];
  }
  return out;
}

function normalizeFindingPath(rawPath: string | null | undefined): string | null {
  if (!rawPath) return null;
  let clean = stripControlChars(rawPath).trim().replace(/\\/g, '/');
  if (!clean) return null;
  const zipSep = clean.indexOf('!/');
  if (zipSep >= 0) clean = clean.slice(zipSep + 2);
  else {
    const epubIdx = clean.toLowerCase().indexOf('.epub/');
    if (epubIdx >= 0) clean = clean.slice(epubIdx + 6);
  }
  clean = clean.replace(/^\/+/, '');
  if (!clean || clean.toLowerCase().endsWith('.epub')) return null;
  return clean.slice(0, 300);
}

function makeFinding(
  sev: string,
  rawCode: string | undefined,
  rawPath: string | null | undefined,
  line: number,
  col: number,
  rawMsg: string | undefined,
): Finding {
  const u = sev.toUpperCase();
  const severity = u === 'ERROR' || u === 'FATAL' ? 'error' : u === 'WARNING' ? 'warning' : 'info';
  const path = normalizeFindingPath(rawPath);
  let location: string | null = null;
  if (line > 0 && col > 0) location = `${line}:${col}`.slice(0, 300);
  else if (line > 0) location = `line ${line}`.slice(0, 300);
  const cleanMsg = stripControlChars(rawMsg ?? 'EPUBCheck finding')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
  return {
    severity,
    code: (rawCode ?? 'EPUBCHECK').slice(0, 80),
    location,
    path,
    message: cleanMsg || 'EPUBCheck finding',
  };
}

function parseFindings(output: string): Finding[] {
  const findings: Finding[] = [];
  const lineRegex = /^(?:ERROR|WARNING|INFO|FATAL|USAGE)(?:\(([^)]+)\))?:\s*(.+)$/i;
  for (const rawLine of output.split('\n').slice(0, 1000)) {
    const line = rawLine.trim();
    if (!/^(?:ERROR|WARNING|INFO|FATAL|USAGE)/i.test(line)) continue;
    const match = line.match(lineRegex);
    const rest = match?.[2]?.trim() ?? line.slice(line.indexOf(':') + 1).trim();
    let rawPath: string | null = null,
      lineNum = -1,
      colNum = -1,
      msg = rest;
    const colonIdx = rest.indexOf(': ');
    if (colonIdx > 0) {
      const target = rest.slice(0, colonIdx).trim();
      msg = rest.slice(colonIdx + 2).trim();
      const locMatch = target.match(/\((\d+)(?:,(\d+))?\)$/);
      if (locMatch) {
        lineNum = Number(locMatch[1]);
        colNum = locMatch[2] ? Number(locMatch[2]) : -1;
        rawPath = target.slice(0, target.lastIndexOf('('));
      } else {
        rawPath = target;
      }
    }
    const sevStr = match?.[1] ? line.slice(0, line.indexOf('(')) : line.slice(0, line.indexOf(':'));
    findings.push(makeFinding(sevStr, match?.[1], rawPath, lineNum, colNum, msg));
    if (findings.length >= 1000) break;
  }
  return findings;
}

function parseJsonReport(reportText: string): Finding[] {
  let p: {
    messages?: Array<{
      id?: string;
      severity?: string;
      message?: string;
      locations?: Array<{ path?: string; line?: number; column?: number }>;
    }>;
  };
  try {
    p = JSON.parse(reportText);
  } catch {
    return [];
  }
  if (!p || !Array.isArray(p.messages)) return [];
  return p.messages.slice(0, 1000).map((i) => {
    const loc = i.locations?.[0];
    return makeFinding(
      i.severity ?? '',
      i.id,
      loc?.path,
      loc?.line ?? -1,
      loc?.column ?? -1,
      i.message,
    );
  });
}

const XML_ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&',
};
function decodeXml(s: string): string {
  return s.replace(/&(?:lt|gt|quot|apos|amp);/g, (e) => XML_ENTITIES[e] ?? e);
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
  const p = rawPath.trim();
  if (!p || p.startsWith('/') || p.startsWith('\\') || /^[a-zA-Z]:/.test(p) || p.includes('\\')) {
    throw new EpubExtractionError('INVALID_PACKAGE_PATH', 'Invalid rootfile path');
  }
  const segments = p.split('/');
  if (segments.some((s) => s === '..' || s === '.' || !s)) {
    throw new EpubExtractionError('INVALID_PACKAGE_PATH', 'Path traversal in rootfile');
  }
  return segments.join('/');
}

function extractRootfilePath(containerXml: string): string | null {
  const matches = containerXml.matchAll(/<rootfile\b([^>]*)\/?>/gi);
  let fallback: string | null = null;
  for (const match of matches) {
    const attrs = match[1] ?? '';
    const fullPath = attrs.match(/\bfull-path\s*=\s*["']([^"']+)["']/i)?.[1];
    const isOpf =
      attrs.match(/\bmedia-type\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ===
      'application/oebps-package+xml';
    if (fullPath) {
      if (isOpf) return fullPath;
      if (!fallback) fallback = fullPath;
    }
  }
  return fallback;
}

function extractOpfFromZip(bytes: Uint8Array): { opf: string | null; opfPath: string | null } {
  let unzippedContainer: Record<string, Uint8Array>;
  try {
    unzippedContainer = unzipSync(bytes, { filter: (f) => f.name === 'META-INF/container.xml' });
  } catch {
    throw new EpubExtractionError('CORRUPT_ARCHIVE', 'Failed to read container.xml');
  }
  const containerBytes = unzippedContainer['META-INF/container.xml'];
  if (!containerBytes) return { opf: null, opfPath: null };
  if (containerBytes.byteLength > MAX_CONTAINER_BYTES) {
    throw new EpubExtractionError('CONTAINER_TOO_LARGE', 'container.xml too large');
  }
  const rawPath = extractRootfilePath(strFromU8(containerBytes));
  if (!rawPath) return { opf: null, opfPath: null };
  const normalizedOpfPath = validateRootfilePath(rawPath);

  let unzippedOpf: Record<string, Uint8Array>;
  try {
    unzippedOpf = unzipSync(bytes, {
      filter: (f) => {
        if (f.name === normalizedOpfPath) {
          if (f.originalSize && f.originalSize > MAX_OPF_BYTES)
            throw new EpubExtractionError('OPF_TOO_LARGE', 'OPF too large');
          return true;
        }
        return false;
      },
    });
  } catch (err) {
    if (err instanceof EpubExtractionError) throw err;
    throw new EpubExtractionError('CORRUPT_ARCHIVE', 'Failed to extract OPF');
  }
  const opfBytes = unzippedOpf[normalizedOpfPath];
  if (!opfBytes) return { opf: null, opfPath: normalizedOpfPath };
  if (opfBytes.byteLength > MAX_OPF_BYTES)
    throw new EpubExtractionError('OPF_TOO_LARGE', 'OPF too large');
  return { opf: strFromU8(opfBytes), opfPath: normalizedOpfPath };
}

function extractEpubVersion(opf: string): string | null {
  const packageMatch = opf.match(/<package\b([^>]*)>/i);
  const versionMatch = packageMatch?.[1]?.match(/\bversion\s*=\s*["']([^"']+)["']/i);
  return versionMatch?.[1]?.trim().slice(0, 10) ?? null;
}

function metadataFromOpf(opf: string): Array<{ key: string; value: string; provenance: 'opf' }> {
  if (!opf || opf.length > MAX_OPF_BYTES) return [];
  const metadata: Array<{ key: string; value: string; provenance: 'opf' }> = [];
  const seen = new Set<string>();
  function add(key: string, rawVal: string) {
    if (metadata.length >= 100) return;
    const value = decodeXml(rawVal).trim().slice(0, 500);
    if (!value || seen.has(`${key}:::${value}`)) return;
    seen.add(`${key}:::${value}`);
    metadata.push({ key, value, provenance: 'opf' });
  }
  for (const m of opf.matchAll(DC_LANG_REGEX)) if (m[1]) add('dc:language', m[1]);
  for (const m of opf.matchAll(LEGACY_ELEM_REGEX))
    if (m[1] && m[2] && TARGET_PROPERTIES_SET.has(m[1])) add(m[1], m[2]);
  for (const m of opf.matchAll(META_TAG_REGEX)) {
    const propMatch = m[1]?.match(PROP_REGEX);
    if (propMatch && TARGET_PROPERTIES_SET.has(propMatch[1])) {
      const val = m[2]?.trim() || m[1]?.match(CONTENT_REGEX)?.[1]?.trim();
      if (val) add(propMatch[1], val);
    }
  }
  return metadata;
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

export {
  server,
  validate,
  parseFindings,
  parseJsonReport,
  normalizeFindingPath,
  metadataFromOpf,
  extractOpfFromZip,
  extractRootfilePath,
  validateRootfilePath,
  extractEpubVersion,
};

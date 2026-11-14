import { unzipSync, strFromU8 } from 'fflate';

const MAX_CONTAINER_BYTES = 64 * 1024;
const MAX_OPF_BYTES = 2 * 1024 * 1024;

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

function stripControlChars(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 32 && code !== 127) out += str[i];
  }
  return out;
}

export function normalizeFindingPath(rawPath: string | null | undefined): string | null {
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

export function parseFindings(output: string): Finding[] {
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

export function parseJsonReport(reportText: string): Finding[] {
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

export function validateRootfilePath(rawPath: string): string {
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

export function extractRootfilePath(containerXml: string): string | null {
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

export function extractOpfFromZip(bytes: Uint8Array): {
  opf: string | null;
  opfPath: string | null;
} {
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

export function extractEpubVersion(opf: string): string | null {
  const packageMatch = opf.match(/<package\b([^>]*)>/i);
  const versionMatch = packageMatch?.[1]?.match(/\bversion\s*=\s*["']([^"']+)["']/i);
  return versionMatch?.[1]?.trim().slice(0, 10) ?? null;
}

export function metadataFromOpf(
  opf: string,
): Array<{ key: string; value: string; provenance: 'opf' }> {
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

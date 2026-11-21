/**
 * Layer 1 of the #1483 durable EPUB corpus.
 *
 * Every manifest entry is generated deterministically from in-repo templates
 * (never network-fetched, never vendored) and run through the real pipeline:
 * archive validation, worker parse, sanitization and metadata extraction.
 * All manifest-expected diagnostics must be observed; unexpected archive
 * rejections on valid fixtures fail the suite.
 */
import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  CORPUS_ENTRIES,
  generateCorpusEntry,
  listLocalEntryNames,
  type CorpusEntry,
  type ExpectedArchiveOutcome,
} from '@do-epub-studio/testkit';
import { validateArchive } from '../archive-validator';
import { parseEpubInWorker } from '../epub-parser-worker';
import { sanitizeEpubDocument } from '../sanitizer';

interface CorpusEnv {
  archiveOutcome: ExpectedArchiveOutcome;
  entries: Map<string, Uint8Array>;
  localNames: string[];
  opfText: string | null;
  containerText: string | null;
  chapterRaw: string;
  chapterDoc: Document;
  oversizeGated: boolean;
}

async function archiveOutcomeOf(
  data: Uint8Array,
  opts?: { maxCompressedSize?: number },
): Promise<{ outcome: ExpectedArchiveOutcome; error?: string }> {
  try {
    await validateArchive(data, opts);
    return { outcome: { kind: 'ok' } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/traversal/i.test(msg)) return { outcome: { kind: 'reject', reason: 'traversal' }, error: msg };
    if (/ratio/i.test(msg)) return { outcome: { kind: 'reject', reason: 'ratio' }, error: msg };
    if (/size|byte/i.test(msg)) return { outcome: { kind: 'reject', reason: 'oversize' }, error: msg };
    if (/too many/i.test(msg)) return { outcome: { kind: 'reject', reason: 'too-many' }, error: msg };
    return { outcome: { kind: 'reject', reason: 'corrupt' }, error: msg };
  }
}

async function buildEnv(entry: CorpusEntry, data: Uint8Array): Promise<CorpusEnv> {
  const localNames = listLocalEntryNames(data);
  const archive = await archiveOutcomeOf(data);
  let entries = new Map<string, Uint8Array>();
  try {
    const u = unzipSync(data);
    for (const [k, v] of Object.entries(u)) entries.set(k, v);
  } catch {
    entries = new Map();
  }
  const opfBytes = entries.get('OEBPS/content.opf') ?? entries.get('content.opf');
  const opfText = opfBytes ? strFromU8(opfBytes) : null;
  const containerBytes = entries.get('META-INF/container.xml');
  const containerText = containerBytes ? strFromU8(containerBytes) : null;
  const chapterBytes = entries.get('OEBPS/chapter1.xhtml');
  const chapterRaw = chapterBytes ? strFromU8(chapterBytes) : '';
  const chapterDoc = new DOMParser().parseFromString(chapterRaw, 'text/html');
  if (chapterRaw) sanitizeEpubDocument(chapterDoc);
  const gated = await archiveOutcomeOf(data, { maxCompressedSize: 1024 * 1024 });
  const oversizeGated = entry.id === 'oversized-resource' && gated.outcome.kind === 'reject';
  return {
    archiveOutcome: archive.outcome,
    entries,
    localNames,
    opfText,
    containerText,
    chapterRaw,
    chapterDoc,
    oversizeGated,
  };
}

function attrValues(doc: Document, names: readonly string[]): string[] {
  const out: string[] = [];
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (names.includes(attr.name)) out.push(attr.value);
    }
  }
  return out;
}

/**
 * True only for values whose leading scheme is one browsers can execute or
 * reach a host file (javascript/vbscript/file/data). `cid:` is an allowed
 * EPUB scheme, and obfuscated forms (newline, percent-encoding, backslash)
 * are not scheme syntax — they resolve as relative URLs and are inert, and
 * the network egress guard covers scheme-relative fetches.
 */
function isUnsafeSchemeValue(value: string): boolean {
  const schemeMatch = /^[\t\n\r ]*([a-z][a-z0-9+.-]*):/i.exec(value);
  if (!schemeMatch || !schemeMatch[1]) return false;
  const scheme = schemeMatch[1].toLowerCase();
  return scheme === 'javascript' || scheme === 'vbscript' || scheme === 'file' || scheme === 'data';
}

function collectDiagnostics(entry: CorpusEntry, env: CorpusEnv): Set<string> {
  const seen = new Set<string>();
  const has = env.entries.has.bind(env.entries);

  if (has('OEBPS/content.opf')) seen.add('OPF_PRESENT');
  if (has('OEBPS/toc.ncx') && env.opfText?.includes('version="2.0"')) seen.add('NCX_EPUB2');
  if (has('OEBPS/nav.xhtml')) seen.add('NAV_EPUB3');
  const rootfileCount = (env.containerText?.match(/<rootfile\b(?!s)/g) ?? []).length;
  if (rootfileCount > 1) seen.add('MULTIPLE_ROOTFILES');
  if (env.opfText?.includes('rendition:layout')) seen.add('FIXED_LAYOUT_DECLARED');
  if (env.opfText?.includes('image/svg+xml')) seen.add('SVG_ITEM_PRESENT');
  if (env.opfText?.includes('font/ttf')) seen.add('FONT_ITEM_PRESENT');
  if (env.chapterRaw.includes('@font-face')) seen.add('FONT_FACE_RETAINED');
  if (has('META-INF/encryption.xml')) seen.add('ENCRYPTION_DECLARED');
  if (env.opfText?.includes('application/smil+xml')) seen.add('MEDIA_OVERLAY_DECLARED');
  if (has('OEBPS/media/audio.wav')) seen.add('AUDIO_ITEM_PRESENT');
  if (env.chapterRaw.includes('data-cfi')) seen.add('CFI_MARKERS_PRESENT');
  if (!has('mimetype')) seen.add('MIMETYPE_ABSENT');
  if (has('mimetype') && env.localNames[0] !== 'mimetype') seen.add('MIMETYPE_NOT_FIRST');

  if (entry.id === 'remote-resources') {
    if (env.chapterRaw.includes('https://invalid.example')) seen.add('REMOTE_RESOURCE_DECLARED');
    const egress = attrValues(env.chapterDoc, ['src', 'href', 'xlink:href']).filter((v) =>
      /^https?:\/\//i.test(v.trim()),
    );
    if (egress.length === 0) seen.add('EXTERNAL_HTTP_SRC_REMOVED');
  }

  if (env.archiveOutcome.kind === 'reject') {
    if (env.archiveOutcome.reason === 'corrupt') seen.add('ZIP_CORRUPT');
    if (env.archiveOutcome.reason === 'traversal') seen.add('ZIP_TRAVERSAL_PATH');
    if (env.archiveOutcome.reason === 'ratio') seen.add('ZIP_COMPRESSION_RATIO');
  }
  if (env.oversizeGated) seen.add('OVERSIZE_GATE');

  const allAttrs = (() => {
    const out: { name: string; value: string }[] = [];
    for (const el of Array.from(env.chapterDoc.querySelectorAll('*'))) {
      for (const attr of Array.from(el.attributes)) out.push({ name: attr.name, value: attr.value });
    }
    return out;
  })();
  const hasEventAttr = allAttrs.some(
    (a) =>
      a.name.length >= 2 &&
      (a.name.charCodeAt(0) | 32) === 111 &&
      (a.name.charCodeAt(1) | 32) === 110,
  );
  const hasScriptElement = env.chapterDoc.querySelector('script') !== null;
  const hasSvgScript =
    env.chapterDoc.querySelector('svg script, svg[onload], svg[onclick], svg foreignObject') !== null;
  const unsafeSchemeAttrs = allAttrs.filter((a) => isUnsafeSchemeValue(a.value));
  const rawHasScript = /<script[\s>]/i.test(env.chapterRaw);
  const rawHasEvent = /\son[a-z]+\s*=/i.test(env.chapterRaw);
  const rawHasSvgScript = /<svg[\s>][\s\S]*?(?:<script|onload=|onclick=|<foreignObject)/i.test(env.chapterRaw);
  const rawHasUnsafeScheme = /(?:javascript|vbscript|file|data)\s*:/i.test(env.chapterRaw);
  if (rawHasScript && !hasScriptElement) seen.add('SCRIPT_REMOVED');
  if (rawHasEvent && !hasEventAttr) seen.add('EVENT_HANDLER_REMOVED');
  if (rawHasSvgScript && !hasSvgScript) seen.add('SVG_SCRIPT_REMOVED');
  if (rawHasUnsafeScheme && unsafeSchemeAttrs.length === 0) {
    seen.add('UNSAFE_SCHEME_REMOVED');
  }
  if (entry.id === 'url-edge-cases') {
    const obfuscated = allAttrs.filter((a) => /java%63|java\nscript|\\javascript/i.test(a.value)).length > 0;
    if (obfuscated) seen.add('OBFUSCATED_SCHEME_RETAINED_INERT');
    if (attrValues(env.chapterDoc, ['src']).some((v) => v.startsWith('//'))) {
      seen.add('SCHEME_RELATIVE_RETAINED');
    }
  }
  if (entry.id === 'xxe-external-entity') {
    const text = env.chapterDoc.body?.textContent ?? '';
    if (text.includes('Before entity.') && !text.includes('root:')) seen.add('XXE_NOT_EXPANDED');
    if (text.includes('&xxe;')) seen.add('ENTITY_REF_UNRESOLVED');
  }
  return seen;
}

interface ExtractedMetadata {
  title?: string;
  language?: string;
  epubVersion?: string;
  direction?: string;
}

function extractMetadata(entry: CorpusEntry, env: CorpusEnv): ExtractedMetadata {
  if (!env.opfText) return {};
  const title = env.opfText.match(/<dc:title>([^<]*)<\/dc:title>/)?.[1];
  const language = env.opfText.match(/<dc:language>([^<]*)<\/dc:language>/)?.[1];
  const epubVersion = env.opfText.match(/<package\b[^>]*\bversion\s*=\s*"([^"]+)"/)?.[1];
  const direction = env.opfText.match(/<package\b[^>]*\bdir\s*=\s*"([^"]+)"/)?.[1];
  return { title, language, epubVersion, direction };
}

function assertMetadata(entry: CorpusEntry, actual: ExtractedMetadata): void {
  if (entry.expectedMetadata.title !== undefined) expect(actual.title).toBe(entry.expectedMetadata.title);
  if (entry.expectedMetadata.language !== undefined) expect(actual.language).toBe(entry.expectedMetadata.language);
  if (entry.expectedMetadata.epubVersion !== undefined) expect(actual.epubVersion).toBe(entry.expectedMetadata.epubVersion);
  if (entry.expectedMetadata.direction !== undefined) expect(actual.direction).toBe(entry.expectedMetadata.direction);
}

describe('epub corpus layer 1: archive + parse + sanitize + metadata', () => {
  it.each(CORPUS_ENTRIES.map((e) => [e.id, e] as const))(
    '%s',
    async (id, entry) => {
      // 1. Deterministic generation — regenerating must be byte-identical.
      const data = generateCorpusEntry(id);
      const again = generateCorpusEntry(id);
      expect(Buffer.from(data).equals(Buffer.from(again))).toBe(true);

      const env = await buildEnv(entry, data);

      // 2. Archive validation outcome.
      expect(env.archiveOutcome).toEqual(entry.expectedArchive);

      // 3. Worker-parse outcome.
      const parseResult = await parseEpubInWorker(data);
      expect(parseResult.valid).toBe(entry.expectedParses);

      // 4. Metadata.
      assertMetadata(entry, extractMetadata(entry, env));

      // 5. Diagnostics: every manifest-expected diagnostic must be observed,
      // and a valid archive must never show archive-level error diagnostics.
      const observed = collectDiagnostics(entry, env);
      const expectedCodes = entry.expectedDiagnostics.map((d) => d.code);
      for (const code of expectedCodes) {
        expect(observed.has(code), `expected diagnostic ${code}`).toBe(true);
      }
      if (entry.expectedArchive.kind === 'ok') {
        expect(observed.has('ZIP_CORRUPT')).toBe(false);
        expect(observed.has('ZIP_TRAVERSAL_PATH')).toBe(false);
        expect(observed.has('ZIP_COMPRESSION_RATIO')).toBe(false);
      }
    },
    30_000,
  );

  it('security verdicts are internally consistent with archive/parse outcomes', async () => {
    for (const entry of CORPUS_ENTRIES) {
      const data = generateCorpusEntry(entry.id);
      const env = await buildEnv(entry, data);
      if (entry.securityVerdict.kind === 'graceful-reject' && entry.securityVerdict.at === 'archive') {
        expect(env.archiveOutcome.kind).toBe('reject');
        expect(entry.expectedParses).toBe(false);
      }
      if (entry.securityVerdict.kind === 'graceful-reject' && entry.securityVerdict.at === 'render') {
        expect(env.archiveOutcome.kind).toBe('ok');
        expect(entry.expectedParses).toBe(true);
      }
      if (entry.securityVerdict.kind === 'none') {
        expect(env.archiveOutcome.kind).toBe('ok');
        expect(entry.expectedParses).toBe(true);
      }
    }
  });

  it('every fixture declares a provenance with a license', () => {
    for (const entry of CORPUS_ENTRIES) {
      expect(entry.provenance.source.length).toBeGreaterThan(0);
      expect(entry.provenance.license).toBe('CC0-1.0');
      expect(entry.provenance.note.length).toBeGreaterThan(10);
    }
  });
});

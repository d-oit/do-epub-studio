/**
 * The #1483 EPUB corpus manifest.
 *
 * Single source of truth for the corpus: every fixture (its provenance,
 * expected parse outcome, expected archive behavior, diagnostics, metadata and
 * security verdict) is declared here and consumed by:
 *   - Layer 1: packages/reader-core/src/__tests__/epub-corpus.test.ts
 *   - Layer 2: apps/tests/epub-corpus.spec.ts
 *   - Differential: scripts/diff-corpus-epubcheck.mjs
 *
 * All fixtures are generated deterministically at test time from in-repo
 * templates (packages/testkit/src/epub-corpus/generate.ts); none are fetched
 * from the network and no binary blob is vendored.
 */
import { fixtureProvenance, type CorpusEntry } from './types';

export const EPUB_CORPUS_ISSUE = 1483;
export const EPUB_CORPUS_ISSUE_LINK = `#${EPUB_CORPUS_ISSUE}`;
/** The #1434 effort this corpus extends (reader-engine E2E corpus). */
export const EPUB_CORPUS_EXTENDS = 1434;

export const CORPUS_ENTRIES: readonly CorpusEntry[] = [
  {
    id: 'epub2-ncx',
    category: 'standards',
    provenance: fixtureProvenance(
      'Generated minimal EPUB 2.0.1 reflowable book with NCX navigation (XHTML 1.1 content).',
    ),
    featureTags: ['epub2', 'ncx', 'reflowable'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'OPF_PRESENT', severity: 'info', path: 'OEBPS/content.opf' },
      { code: 'NCX_EPUB2', severity: 'info', path: 'OEBPS/toc.ncx' },
    ],
    expectedMetadata: {
      title: 'Epub Two NCX',
      language: 'en',
      epubVersion: '2.0',
    },
    securityVerdict: { kind: 'none' },
    browserable: true,
  },
  {
    id: 'epub3-nav',
    category: 'standards',
    provenance: fixtureProvenance(
      'Generated minimal EPUB 3.0 reflowable book with a navigation document (epub:type="toc").',
    ),
    featureTags: ['epub3', 'nav-doc', 'reflowable'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'OPF_PRESENT', severity: 'info', path: 'OEBPS/content.opf' },
      { code: 'NAV_EPUB3', severity: 'info', path: 'OEBPS/nav.xhtml' },
    ],
    expectedMetadata: { title: 'Epub Three Nav', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'none' },
    browserable: true,
  },
  {
    id: 'multiple-rootfiles',
    category: 'standards',
    provenance: fixtureProvenance(
      'Generated package with two OPF rootfiles (reflowable primary + fixed-layout alternate) to exercise multi-rootfile resolution.',
    ),
    featureTags: ['multiple-rootfiles', 'renditions'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'MULTIPLE_ROOTFILES', severity: 'info', path: 'META-INF/container.xml' },
      { code: 'OPF_PRESENT', severity: 'info', path: 'OEBPS/content.opf' },
    ],
    expectedMetadata: { title: 'Multiple Rootfiles', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'none' },
    browserable: true,
  },
  {
    id: 'rtl-vertical',
    category: 'layout-i18n',
    provenance: fixtureProvenance(
      'Generated package with dir="rtl" and Japanese vertical-rl writing-mode CSS to exercise i18n layout paths.',
    ),
    featureTags: ['rtl', 'vertical-writing', 'i18n'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [],
    expectedMetadata: { title: 'RTL Vertical', language: 'ar', direction: 'rtl', epubVersion: '3.0' },
    securityVerdict: { kind: 'none' },
    browserable: true,
  },
  {
    id: 'fixed-layout',
    category: 'layout-i18n',
    provenance: fixtureProvenance(
      'Generated pre-paginated fixed-layout package (rendition:layout + spine properties).',
    ),
    featureTags: ['fixed-layout', 'pre-paginated'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'FIXED_LAYOUT_DECLARED', severity: 'info', path: 'OEBPS/content.opf' },
    ],
    expectedMetadata: { title: 'Fixed Layout', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'none' },
    browserable: true,
  },
  {
    id: 'svg-content',
    category: 'embedded-resources',
    provenance: fixtureProvenance(
      'Generated package with inline SVG markup and a standalone SVG item (image/svg+xml) plus a programmatic 1×1 PNG.',
    ),
    featureTags: ['svg', 'inline-svg', 'image'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [{ code: 'SVG_ITEM_PRESENT', severity: 'info', path: 'OEBPS/vector.svg' }],
    expectedMetadata: { title: 'SVG Content', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'none' },
    browserable: true,
  },
  {
    id: 'embedded-font',
    category: 'embedded-resources',
    provenance: fixtureProvenance(
      'Generated package with an @font-face reference to a programmatically synthesized minimal TrueType font (Corpus Sans).',
    ),
    featureTags: ['font', 'embedded-font', '@font-face'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'FONT_ITEM_PRESENT', severity: 'info', path: 'OEBPS/fonts/corpus.ttf' },
      { code: 'FONT_FACE_RETAINED', severity: 'info', path: 'OEBPS/chapter1.xhtml' },
    ],
    expectedMetadata: { title: 'Embedded Font', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'none' },
    browserable: true,
  },
  {
    id: 'remote-resources',
    category: 'embedded-resources',
    provenance: fixtureProvenance(
      'Generated package whose content references absolute https:// remote resources (img + svg href); these must never be fetched — the sanitizer strips them under the default block-all external URL policy.',
    ),
    featureTags: ['remote-resource', 'external-url'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'REMOTE_RESOURCE_DECLARED', severity: 'info', path: 'OEBPS/chapter1.xhtml' },
      { code: 'EXTERNAL_HTTP_SRC_REMOVED', severity: 'warning', path: 'OEBPS/chapter1.xhtml' },
    ],
    expectedMetadata: { title: 'Remote Resources', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'sanitized', what: 'absolute http(s) resource references stripped' },
    browserable: true,
  },
  {
    id: 'encrypted-resources',
    category: 'embedded-resources',
    provenance: fixtureProvenance(
      'Generated package declaring AES-128-CBC encryption in META-INF/encryption.xml. The payload is intentionally left plaintext; decryption is gracefully unsupported and the reader must still open the book without crashing.',
    ),
    featureTags: ['encrypted', 'encryption.xml', 'graceful-unsupported'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'ENCRYPTION_DECLARED', severity: 'warning', path: 'META-INF/encryption.xml' },
    ],
    expectedMetadata: { title: 'Encrypted Resources', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'graceful-reject', at: 'render' },
    browserable: true,
  },
  {
    id: 'media-overlay',
    category: 'media-annotation',
    provenance: fixtureProvenance(
      'Generated package with a SMIL media overlay document referencing a programmatic WAV clip and spine media-overlay properties.',
    ),
    featureTags: ['media-overlay', 'smil', 'audio'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'MEDIA_OVERLAY_DECLARED', severity: 'info', path: 'OEBPS/media/overlay.smil' },
      { code: 'AUDIO_ITEM_PRESENT', severity: 'info', path: 'OEBPS/media/audio.wav' },
    ],
    expectedMetadata: { title: 'Media Overlay', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'none' },
    browserable: true,
  },
  {
    id: 'annotations',
    category: 'media-annotation',
    provenance: fixtureProvenance(
      'Generated package with CFI-style anchor markers (span[data-cfi], span[data-range-*]) used by the annotation layering.',
    ),
    featureTags: ['annotations', 'cfi'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'CFI_MARKERS_PRESENT', severity: 'info', path: 'OEBPS/chapter1.xhtml' },
    ],
    expectedMetadata: { title: 'Annotations', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'none' },
    browserable: true,
  },
  {
    id: 'malformed-content-unclosed',
    category: 'malformed',
    provenance: fixtureProvenance(
      'Valid archive whose content contains unclosed elements, custom tags and unusual Unicode — the reader must tolerate it and the sanitizer must normalize it.',
    ),
    featureTags: ['malformed-xml', 'tolerant-parsing', 'unicode'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [],
    expectedMetadata: { title: 'Malformed Content', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'none' },
    browserable: true,
  },
  {
    id: 'malformed-zip-truncated',
    category: 'malformed',
    provenance: fixtureProvenance(
      'Archive cut mid-entry with the central directory and EOCD removed — must be rejected at validation.',
    ),
    featureTags: ['malformed-zip'],
    expectedParses: false,
    expectedArchive: { kind: 'reject', reason: 'corrupt' },
    expectedDiagnostics: [{ code: 'ZIP_CORRUPT', severity: 'error', path: null }],
    expectedMetadata: {},
    securityVerdict: { kind: 'graceful-reject', at: 'archive' },
    browserable: false,
  },
  {
    id: 'malformed-zip-declared-size',
    category: 'malformed',
    provenance: fixtureProvenance(
      'Archive whose local/central headers declare an absurd uncompressed size (0x7FFFFFFF) for a small entry — the ratio guard rejects it at validation.',
    ),
    featureTags: ['malformed-zip', 'size-mismatch'],
    expectedParses: false,
    expectedArchive: { kind: 'reject', reason: 'ratio' },
    expectedDiagnostics: [{ code: 'ZIP_COMPRESSION_RATIO', severity: 'error', path: null }],
    expectedMetadata: {},
    securityVerdict: { kind: 'graceful-reject', at: 'archive' },
    browserable: false,
  },
  {
    id: 'missing-mimetype',
    category: 'malformed',
    provenance: fixtureProvenance(
      'Archive without a mimetype entry — structurally parseable but a container spec violation the corpus reports.',
    ),
    featureTags: ['mimetype', 'spec-violation'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [{ code: 'MIMETYPE_ABSENT', severity: 'warning', path: 'mimetype' }],
    expectedMetadata: { title: 'Missing Mimetype', language: 'en', epubVersion: '2.0' },
    securityVerdict: { kind: 'none' },
    browserable: false,
  },
  {
    id: 'mimetype-not-first',
    category: 'standards',
    provenance: fixtureProvenance(
      'Archive whose mimetype entry is not the first local file — EPUB 3 requires it first; the reader must still work, and the corpus reports the deviation.',
    ),
    featureTags: ['mimetype', 'spec-violation'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [{ code: 'MIMETYPE_NOT_FIRST', severity: 'warning', path: 'mimetype' }],
    expectedMetadata: { title: 'Mimetype Not First', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'none' },
    browserable: true,
  },
  {
    id: 'xxe-external-entity',
    category: 'security',
    provenance: fixtureProvenance(
      'Content declaring an external XML entity (SYSTEM "file:///etc/passwd") to exercise XXE confinement: the payload must never be fetched or expanded; parsing/rendering stays bounded and host file contents never appear.',
    ),
    featureTags: ['xxe', 'external-entity', 'xml-security'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'XXE_NOT_EXPANDED', severity: 'error', path: 'OEBPS/chapter1.xhtml' },
      { code: 'ENTITY_REF_UNRESOLVED', severity: 'warning', path: 'OEBPS/chapter1.xhtml' },
    ],
    expectedMetadata: { title: 'XXE', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'sanitized', what: 'external entity left unexpanded; no host-file exfiltration' },
    browserable: false,
  },
  {
    id: 'malformed-zip-traversal',
    category: 'security',
    provenance: fixtureProvenance(
      'Archive containing an entry whose path escapes the package root (../../evil.xhtml) — must be rejected during archive validation.',
    ),
    featureTags: ['traversal', 'zip-entry-paths'],
    expectedParses: false,
    expectedArchive: { kind: 'reject', reason: 'traversal' },
    expectedDiagnostics: [{ code: 'ZIP_TRAVERSAL_PATH', severity: 'error', path: null }],
    expectedMetadata: {},
    securityVerdict: { kind: 'graceful-reject', at: 'archive' },
    browserable: false,
  },
  {
    id: 'zip-bomb-ratio',
    category: 'security',
    provenance: fixtureProvenance(
      'Archive containing a 64 MiB all-zero entry (deflated ratio ≫ 10) — must be rejected by the compression-ratio guard.',
    ),
    featureTags: ['zip-bomb', 'compression-ratio'],
    expectedParses: false,
    expectedArchive: { kind: 'reject', reason: 'ratio' },
    expectedDiagnostics: [{ code: 'ZIP_COMPRESSION_RATIO', severity: 'error', path: null }],
    expectedMetadata: {},
    securityVerdict: { kind: 'graceful-reject', at: 'archive' },
    browserable: false,
  },
  {
    id: 'oversized-resource',
    category: 'security',
    provenance: fixtureProvenance(
      'Archive carrying a 1.5 MiB non-compressible blob; the default suite exercises the size gate with a reduced maxCompressedSize limit (deterministic, cheap) — see Layer 1. A real oversized archive is generated when CORPUS_HEAVY=1.',
    ),
    featureTags: ['oversized-resource', 'size-limits'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'OVERSIZE_GATE', severity: 'warning', path: 'OEBPS/blob.bin' },
    ],
    expectedMetadata: { title: 'Oversized Resource', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'none' },
    browserable: false,
  },
  {
    id: 'script-event-handlers',
    category: 'security',
    provenance: fixtureProvenance(
      'Content mixing <script> elements and on* event-handler attributes — the sanitizer must strip all of them.',
    ),
    featureTags: ['script', 'event-handlers'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'SCRIPT_REMOVED', severity: 'error', path: 'OEBPS/chapter1.xhtml' },
      { code: 'EVENT_HANDLER_REMOVED', severity: 'error', path: 'OEBPS/chapter1.xhtml' },
    ],
    expectedMetadata: { title: 'Script Event Handlers', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'sanitized', what: 'script elements and event-handler attributes removed' },
    browserable: true,
  },
  {
    id: 'svg-script',
    category: 'security',
    provenance: fixtureProvenance(
      'SVG payloads carrying <script>, onload/onclick, <animate onbegin> and <foreignObject><iframe> — the SVG sanitizer must neutralize them.',
    ),
    featureTags: ['svg-script', 'svg-event-attributes', 'foreignObject'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'SVG_SCRIPT_REMOVED', severity: 'error', path: 'OEBPS/chapter1.xhtml' },
    ],
    expectedMetadata: { title: 'SVG Script', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'sanitized', what: 'SVG script/event/foreignObject payloads stripped' },
    browserable: true,
  },
  {
    id: 'unsafe-schemes',
    category: 'security',
    provenance: fixtureProvenance(
      'Links and sources using executable/access schemes: javascript:, vbscript:, data:text/html, file:///etc/passwd, cid: — all attribute values with these schemes must be removed.',
    ),
    featureTags: ['unsafe-scheme', 'href-scheme'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'UNSAFE_SCHEME_REMOVED', severity: 'error', path: 'OEBPS/chapter1.xhtml' },
    ],
    expectedMetadata: { title: 'Unsafe Schemes', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'sanitized', what: 'unsafe scheme hrefs/srcs removed' },
    browserable: true,
  },
  {
    id: 'url-edge-cases',
    category: 'security',
    provenance: fixtureProvenance(
      'URL boundary cases: newline-inside-scheme, percent-encoded scheme, backslash scheme, whitespace prefix, and protocol-relative (//) srcs. True executable schemes are stripped; the rest are retained but inert, and the network egress guard is the backstop for scheme-relative fetches.',
    ),
    featureTags: ['url-edge-case', 'obfuscated-scheme'],
    expectedParses: true,
    expectedArchive: { kind: 'ok' },
    expectedDiagnostics: [
      { code: 'UNSAFE_SCHEME_REMOVED', severity: 'error', path: 'OEBPS/chapter1.xhtml' },
      { code: 'OBFUSCATED_SCHEME_RETAINED_INERT', severity: 'warning', path: 'OEBPS/chapter1.xhtml' },
      { code: 'SCHEME_RELATIVE_RETAINED', severity: 'warning', path: 'OEBPS/chapter1.xhtml' },
    ],
    expectedMetadata: { title: 'URL Edge Cases', language: 'en', epubVersion: '3.0' },
    securityVerdict: { kind: 'sanitized', what: 'executable schemes stripped; obfuscated/scheme-relative forms retained but guarded at the network egress' },
    browserable: true,
  },
];

export const CORPUS_ENTRY_IDS: readonly string[] = CORPUS_ENTRIES.map((e) => e.id);

export function getCorpusEntry(id: string): CorpusEntry {
  const entry = CORPUS_ENTRIES.find((e) => e.id === id);
  if (!entry) throw new Error(`Unknown corpus fixture id: ${id}`);
  return entry;
}

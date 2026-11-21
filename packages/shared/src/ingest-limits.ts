/**
 * EPUB ingest limits policy — the single source of truth for every place an
 * untrusted EPUB crosses the ingestion boundary (upload, validation queue,
 * reader import). Import this module wherever an archive is validated or
 * parsed and consume {@link DEFAULT_INGEST_LIMITS} (or a documented override)
 * so every path enforces the same budgets with the same rejections.
 *
 * Why these budgets exist (see issue #1484):
 * - EPUB files are untrusted ZIP containers. A hostile archive can claim tiny
 *   header sizes while expanding into gigabytes during decompression (zip
 *   bomb), hide traversal paths, or carry encrypted/symlink entries that
 *   extractors mishandle.
 * - Every limit below is enforced *before* expensive parsing and *again*
 *   while streaming decompressed bytes — header sizes are never trusted.
 * - All rejections use the stable {@link ArchiveRejectionCode} taxonomy so
 *   API responses, queue reports, and reader errors are deterministic, typed,
 *   and user-readable without leaking server internals.
 */

/** Budgets applied to a single untrusted EPUB archive. */
export interface IngestLimits {
  /** Total compressed size of the whole archive, in bytes. */
  maxCompressedBytes: number;
  /** Cumulative decompressed bytes across all entries, in bytes. */
  maxExpandedBytes: number;
  /** Decompressed bytes for a single entry (image, font, XML, …). */
  maxExpandedEntryBytes: number;
  /** Maximum number of entries allowed in one archive. */
  maxEntryCount: number;
  /**
   * Maximum expanded/compressed ratio for a single deflated entry. Ratios
   * above this are treated as zip-bomb indicators. Stored (uncompressed)
   * entries have ratio ~1 and are exempt.
   */
  maxCompressionRatio: number;
  /** Maximum encoded (byte) size of any single XML/SMIL document. */
  maxXmlDocumentBytes: number;
  /** Maximum element nesting depth inside an XML/SMIL document. */
  maxXmlNestingDepth: number;
  /** Maximum number of elements inside an XML/SMIL document. */
  maxXmlElementCount: number;
  /** Wall-clock budget for the whole ingest pipeline, in milliseconds. */
  maxParseDurationMs: number;
}

/**
 * Default limits. Every consumer SHOULD use these unless it documents a
 * narrower override (e.g. the annotation exporter caps source archives at
 * 8 MiB — a stricter, still-safe policy for its context).
 */
export const DEFAULT_INGEST_LIMITS: Readonly<IngestLimits> = Object.freeze({
  maxCompressedBytes: 100 * 1024 * 1024,
  maxExpandedBytes: 1024 * 1024 * 1024,
  maxExpandedEntryBytes: 64 * 1024 * 1024,
  maxEntryCount: 10_000,
  maxCompressionRatio: 10,
  maxXmlDocumentBytes: 8 * 1024 * 1024,
  maxXmlNestingDepth: 256,
  maxXmlElementCount: 100_000,
  maxParseDurationMs: 30_000,
});

/** Merge caller overrides onto the defaults, returning a fresh object. */
export function resolveIngestLimits(overrides?: Partial<IngestLimits>): IngestLimits {
  return overrides ? { ...DEFAULT_INGEST_LIMITS, ...overrides } : { ...DEFAULT_INGEST_LIMITS };
}

/**
 * Stable rejection taxonomy. Codes are wire-stable: renaming a code is a
 * breaking change for API consumers, queue reports, and stored failure codes.
 */
export const ARCHIVE_REJECTION_CODES = [
  'invalid-archive',
  'compressed-size',
  'entry-count',
  'expanded-size',
  'per-entry-size',
  'ratio',
  'unsafe-path',
  'duplicate-path',
  'symlink-entry',
  'unsupported-entry',
  'encrypted-entry',
  'timeout',
  'xml-budget',
] as const;

export type ArchiveRejectionCode = (typeof ARCHIVE_REJECTION_CODES)[number];

/** A deterministic, typed, user-readable archive rejection. */
export interface ArchiveRejection {
  readonly kind: 'rejection';
  readonly code: ArchiveRejectionCode;
  /** User-readable message. Never contains server internals. */
  readonly message: string;
  /** Offending entry name (sanitized, truncated) when entry-specific. */
  readonly entry?: string;
  /** The limit that was exceeded, when applicable. */
  readonly limit?: number;
  /** The measured value that exceeded the limit, when applicable. */
  readonly value?: number;
}

/** Keep user-visible entry names printable and short. */
function sanitizeEntryName(name: string): string {
  const printable = [...name]
    .map((ch) => (ch.charCodeAt(0) >= 0x20 && ch !== '\u007f' ? ch : '\ufffd'))
    .join('');
  return printable.length > 120 ? `${printable.slice(0, 120)}…` : printable;
}

const MESSAGES: Record<ArchiveRejectionCode, string> = {
  'invalid-archive': 'The file is not a valid EPUB archive.',
  'compressed-size': 'The archive exceeds the maximum file size.',
  'entry-count': 'The archive contains too many entries.',
  'expanded-size': 'The extracted contents exceed the maximum expanded size.',
  'per-entry-size': 'A file inside the archive exceeds the maximum per-file size.',
  ratio: 'A file inside the archive has a suspicious compression ratio and was rejected.',
  'unsafe-path': 'The archive contains an unsafe file path and was rejected.',
  'duplicate-path': 'The archive contains duplicate file paths and was rejected.',
  'symlink-entry': 'The archive contains a symbolic link entry, which is not supported.',
  'unsupported-entry': 'The archive contains an unsupported entry type.',
  'encrypted-entry': 'The archive contains an encrypted entry, which is not supported.',
  timeout: 'Processing the archive took too long and was cancelled.',
  'xml-budget': 'An XML document inside the archive exceeds the allowed size or structure.',
};

/**
 * Build a rejection with a stable code and user-readable message.
 * `entry` is included for entry-specific rejections, sanitized.
 */
export function archiveRejection(
  code: ArchiveRejectionCode,
  opts?: { entry?: string; limit?: number; value?: number },
): ArchiveRejection {
  return {
    kind: 'rejection',
    code,
    message: MESSAGES[code],
    ...(opts?.entry !== undefined ? { entry: sanitizeEntryName(opts.entry) } : {}),
    ...(opts?.limit !== undefined ? { limit: opts.limit } : {}),
    ...(opts?.value !== undefined ? { value: opts.value } : {}),
  };
}

/** HTTP status for a rejection code. All are 4xx/5xx, never 500. */
export function archiveRejectionStatusCode(code: ArchiveRejectionCode): number {
  switch (code) {
    case 'compressed-size':
    case 'entry-count':
    case 'expanded-size':
    case 'per-entry-size':
      return 413;
    case 'timeout':
      return 504;
    default:
      return 422;
  }
}

/** Error carrying an {@link ArchiveRejection}; thrown by the archive validator. */
export class ArchiveRejectionError extends Error {
  readonly kind = 'rejection' as const;
  readonly code: ArchiveRejectionCode;
  readonly rejection: ArchiveRejection;
  readonly entry?: string;
  readonly limit?: number;
  readonly value?: number;

  constructor(rejection: ArchiveRejection) {
    super(rejection.message);
    this.name = 'ArchiveRejectionError';
    this.rejection = rejection;
    this.code = rejection.code;
    this.entry = rejection.entry;
    this.limit = rejection.limit;
    this.value = rejection.value;
  }
}

export function isArchiveRejection(error: unknown): error is ArchiveRejectionError {
  return error instanceof ArchiveRejectionError;
}

/**
 * Map any unknown error from the ingest pipeline onto a typed rejection.
 * Timeouts become `timeout`; everything else becomes `invalid-archive`
 * (safe, user-readable) instead of leaking internals.
 */
export function archiveRejectionFromError(error: unknown): ArchiveRejectionError {
  if (isArchiveRejection(error)) return error;
  if (error instanceof Error && error.name === 'TimeoutError') {
    return new ArchiveRejectionError(archiveRejection('timeout'));
  }
  return new ArchiveRejectionError(archiveRejection('invalid-archive'));
}

// ---------------------------------------------------------------------------
// XML / SMIL document budgets
// ---------------------------------------------------------------------------

/** File extensions treated as XML/SMIL documents for budget purposes. */
export const XML_DOCUMENT_EXTENSIONS: Readonly<Record<string, true>> = Object.freeze({
  xml: true,
  opf: true,
  ncx: true,
  xhtml: true,
  html: true,
  htm: true,
  smil: true,
  svg: true,
});

/** True when `name` identifies an XML/SMIL document that must be budgeted. */
export function isXmlDocumentName(name: string): boolean {
  const slash = name.lastIndexOf('/');
  const dot = name.lastIndexOf('.');
  if (dot <= slash) return false;
  return name.slice(dot + 1).toLowerCase() in XML_DOCUMENT_EXTENSIONS;
}

/** Find the `>` ending a start tag, respecting quoted attribute values. */
function findStartTagEnd(text: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return -1;
}

/** Skip a `<!DOCTYPE …>` / `<!…>` declaration, returning the index after `>`. */
function skipDeclaration(text: string, from: number): number {
  let bracketDepth = 0;
  let quote: string | null = null;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '[') {
      bracketDepth += 1;
    } else if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (ch === '>' && bracketDepth === 0) {
      return i + 1;
    }
  }
  return text.length;
}

/**
 * Enforce XML/SMIL structural budgets on an already-decoded document.
 * Byte budgets are enforced upstream on *encoded* bytes (see
 * {@link maxXmlDocumentBytes}); this scanner only bounds nesting depth and
 * element count, with a cheap linear pass over the decoded text.
 *
 * This is a budget guard, not an XML parser: it bounds the worst case and
 * may conservatively reject pathological-but-parseable documents.
 */
export function checkXmlDocumentBudget(
  text: string,
  limits: Pick<IngestLimits, 'maxXmlNestingDepth' | 'maxXmlElementCount'>,
): ArchiveRejection | null {
  let depth = 0;
  let elements = 0;
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt === -1) break;
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      i = end === -1 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9);
      i = end === -1 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith('<?', lt)) {
      const end = text.indexOf('?>', lt + 2);
      i = end === -1 ? text.length : end + 2;
      continue;
    }
    if (text.startsWith('<!', lt)) {
      i = skipDeclaration(text, lt + 2);
      continue;
    }
    if (text.startsWith('</', lt)) {
      const gt = text.indexOf('>', lt + 2);
      if (gt === -1) break;
      if (depth > 0) depth -= 1;
      i = gt + 1;
      continue;
    }
    const gt = findStartTagEnd(text, lt + 1);
    if (gt === -1) break;
    const nameStart = lt + 1;
    let nameEnd = nameStart;
    while (
      nameEnd < gt &&
      text[nameEnd] !== ' ' &&
      text[nameEnd] !== '\t' &&
      text[nameEnd] !== '\n' &&
      text[nameEnd] !== '\r' &&
      text[nameEnd] !== '/' &&
      text[nameEnd] !== '>'
    ) {
      nameEnd += 1;
    }
    if (nameEnd === nameStart) {
      // Not a recognizable element (e.g. bare '<' in text). Skip it.
      i = gt + 1;
      continue;
    }
    const selfClosing = text[gt - 1] === '/';
    if (!selfClosing) {
      depth += 1;
      if (depth > limits.maxXmlNestingDepth) {
        return archiveRejection('xml-budget', {
          limit: limits.maxXmlNestingDepth,
          value: depth,
        });
      }
    }
    elements += 1;
    if (elements > limits.maxXmlElementCount) {
      return archiveRejection('xml-budget', {
        limit: limits.maxXmlElementCount,
        value: elements,
      });
    }
    i = gt + 1;
  }
  return null;
}

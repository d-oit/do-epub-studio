import { UnzipInflate } from 'fflate';
import { withTimeout } from './timeout';
import { createTraceId } from './telemetry';
import {
  type IngestLimits,
  type ArchiveRejection,
  ArchiveRejectionError,
  archiveRejection,
  archiveRejectionFromError,
  checkXmlDocumentBudget,
  isXmlDocumentName,
  resolveIngestLimits,
} from './ingest-limits';

/**
 * One end-to-end resource budget for untrusted EPUB/ZIP ingestion, enforced
 * consistently at upload, validation, and reader import. See
 * `packages/shared/src/ingest-limits.ts` for the documented policy; this
 * module implements it in two phases:
 *
 * 1. Central-directory preflight — parse the ZIP central directory and reject
 *    before any decompression: malformed/truncated archives, path traversal,
 *    absolute paths, duplicate normalized paths (Unicode NFC/NFD
 *    collisions), symlink/unsupported entry types, encrypted entries, entry
 *    count, compressed size, and suspicious header-declared compression
 *    ratios.
 * 2. Streaming enforcement — decompress with fflate while measuring *actual*
 *    expanded bytes per entry and cumulatively (header sizes are never
 *    trusted), bounding XML/SMIL document bytes by encoded bytes plus nesting
 *    depth/element count, and aborting on the wall-clock budget.
 */

export interface ArchiveValidationOptions {
  /** Wall-clock budget in ms (defaults to `limits.maxParseDurationMs`). */
  timeoutMs?: number;
  traceId?: string;
  /** Overrides on top of {@link DEFAULT_INGEST_LIMITS}. */
  limits?: Partial<IngestLimits>;
}

export {
  ArchiveRejectionError,
  archiveRejection,
  archiveRejectionFromError,
  archiveRejectionStatusCode,
  DEFAULT_INGEST_LIMITS,
  ARCHIVE_REJECTION_CODES,
  type IngestLimits,
  type ArchiveRejection,
  type ArchiveRejectionCode,
} from './ingest-limits';
// ---------------------------------------------------------------------------

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;
const MAX_EOCD_SCAN_BYTES = 65_557; // 65535-byte comment + 22-byte EOCD
const MAX_PATH_BYTES = 4096;
const ZIP64_SENTINEL = 0xffff;

interface CdEntry {
  name: string;
  method: number;
  flags: number;
  compressedSize: number;
  uncompressedSize: number;
  externalAttrs: number;
  versionMadeBy: number;
  isDirectory: boolean;
}

interface CentralDirectory {
  entries: CdEntry[];
}

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: false });
const LATIN1_DECODER = new TextDecoder('latin1', { fatal: false });
const XML_TEXT_DECODER = new TextDecoder('utf-8', { fatal: false });

function mergeChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const part of chunks) {
    merged.set(part, offset);
    offset += part.byteLength;
  }
  return merged;
}

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] as number) | ((bytes[offset + 1] as number) << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] as number) |
    ((bytes[offset + 1] as number) << 8) |
    ((bytes[offset + 2] as number) << 16) |
    ((bytes[offset + 3] as number) << 24)
  );
}

function invalid(): ArchiveRejection {
  return archiveRejection('invalid-archive');
}

/**
 * Locate the End-of-Central-Directory record by scanning the last 64 KiB+22
 * bytes for the signature. Returns -1 when absent.
 */
function findEocd(data: Uint8Array): number {
  const start = Math.max(0, data.byteLength - MAX_EOCD_SCAN_BYTES);
  for (let i = data.byteLength - 22; i >= start; i -= 1) {
    if (readU32(data, i) === EOCD_SIG) return i;
  }
  return -1;
}

/**
 * Parse the central directory WITHOUT decompressing anything. Returns a typed
 * rejection when the directory is malformed, truncated, or uses unsupported
 * (ZIP64) structures.
 */
function parseCentralDirectory(data: Uint8Array): CentralDirectory | ArchiveRejection {
  if (data.byteLength < 22) return invalid();
  const eocdOffset = findEocd(data);
  if (eocdOffset === -1) return invalid();

  if (readU16(data, eocdOffset + 4) !== 0 || readU16(data, eocdOffset + 6) !== 0) {
    return invalid(); // multi-disk archives unsupported
  }
  const declaredCount = readU16(data, eocdOffset + 10);
  const cdSize = readU32(data, eocdOffset + 12);
  const cdOffset = readU32(data, eocdOffset + 16);
  if (declaredCount === ZIP64_SENTINEL || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    return invalid(); // ZIP64 uses 64-bit fields we deliberately do not parse
  }
  if (cdOffset + cdSize > data.byteLength) return invalid(); // truncated CD

  const entries: CdEntry[] = [];
  let pos = cdOffset;
  const cdEnd = cdOffset + cdSize;
  while (pos < cdEnd) {
    if (pos + 46 > cdEnd || readU32(data, pos) !== CDH_SIG) return invalid();
    const versionMadeBy = readU16(data, pos + 4);
    const flags = readU16(data, pos + 8);
    const method = readU16(data, pos + 10);
    const compressedSize = readU32(data, pos + 20);
    const uncompressedSize = readU32(data, pos + 24);
    const nameLen = readU16(data, pos + 28);
    const extraLen = readU16(data, pos + 30);
    const commentLen = readU16(data, pos + 32);
    const externalAttrs = readU32(data, pos + 38);
    const headerEnd = pos + 46 + nameLen + extraLen + commentLen;
    if (headerEnd > cdEnd) return invalid();
    if (nameLen > MAX_PATH_BYTES) {
      return archiveRejection('unsafe-path');
    }
    const rawName = data.subarray(pos + 46, pos + 46 + nameLen);
    const name =
      (flags & 0x800) !== 0 ? UTF8_DECODER.decode(rawName) : LATIN1_DECODER.decode(rawName);
    entries.push({
      name,
      method,
      flags,
      compressedSize,
      uncompressedSize,
      externalAttrs,
      versionMadeBy,
      isDirectory: name.endsWith('/'),
    });
    pos = headerEnd;
  }
  if (entries.length !== declaredCount) return invalid();
  return { entries };
}

// ---------------------------------------------------------------------------
// Preflight checks on central-directory metadata
// ---------------------------------------------------------------------------

const DRIVE_LETTER = /^[a-zA-Z]:/;

/** Returns a rejection for unsafe or unsupported paths, or null when safe. */
function checkPathSafety(entry: CdEntry): ArchiveRejection | null {
  const { name } = entry;
  if (name.length === 0 || name.includes('\0') || name.includes('\\')) {
    return archiveRejection('unsafe-path', { entry: name });
  }
  if (name.startsWith('/') || name.startsWith('//') || DRIVE_LETTER.test(name)) {
    return archiveRejection('unsafe-path', { entry: name });
  }
  const trimmed = entry.isDirectory ? name.slice(0, -1) : name;
  if (trimmed.length === 0) return archiveRejection('unsafe-path', { entry: name });
  const segments = trimmed.split('/');
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i] as string;
    if (segment.length === 0 || segment === '.' || segment === '..') {
      return archiveRejection('unsafe-path', { entry: name });
    }
  }
  return null;
}

function checkEntryType(entry: CdEntry): ArchiveRejection | null {
  if ((entry.flags & 0x1) !== 0) {
    return archiveRejection('encrypted-entry', { entry: entry.name });
  }
  if (entry.method !== 0 && entry.method !== 8) {
    return archiveRejection('unsupported-entry', { entry: entry.name });
  }
  const madeByUnix = entry.versionMadeBy >>> 8 === 3;
  if (madeByUnix) {
    const mode = entry.externalAttrs >>> 16;
    const type = mode & 0xf000;
    if (type === 0xa000) return archiveRejection('symlink-entry', { entry: entry.name });
    if (type !== 0x8000 && type !== 0x4000 && type !== 0) {
      return archiveRejection('unsupported-entry', { entry: entry.name });
    }
  }
  return null;
}

function checkRatioPreflight(entry: CdEntry, maxRatio: number): ArchiveRejection | null {
  if (entry.method === 0) return null; // stored entries expand ~1:1
  if (entry.compressedSize === 0 && entry.uncompressedSize > 0) {
    return archiveRejection('ratio', { entry: entry.name });
  }
  if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > maxRatio) {
    return archiveRejection('ratio', {
      entry: entry.name,
      limit: maxRatio,
      value: entry.uncompressedSize / entry.compressedSize,
    });
  }
  return null;
}

/**
 * Run all central-directory preflight checks. Returns null when the archive
 * passes, otherwise the first rejection (deterministic order).
 */
function preflightCentralDirectory(
  cd: CentralDirectory,
  limits: IngestLimits,
): ArchiveRejection | null {
  if (cd.entries.length > limits.maxEntryCount) {
    return archiveRejection('entry-count', {
      limit: limits.maxEntryCount,
      value: cd.entries.length,
    });
  }
  const seenCanonical = new Map<string, string>();
  for (const entry of cd.entries) {
    const unsafe = checkPathSafety(entry);
    if (unsafe) return unsafe;
    const type = checkEntryType(entry);
    if (type) return type;
    const ratio = checkRatioPreflight(entry, limits.maxCompressionRatio);
    if (ratio) return ratio;
    const canonical = (entry.isDirectory ? entry.name.slice(0, -1) : entry.name).normalize('NFC');
    if (seenCanonical.has(canonical)) {
      return archiveRejection('duplicate-path', { entry: entry.name });
    }
    seenCanonical.set(canonical, entry.name);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Streaming enforcement (measured expanded bytes; never trust headers)
// ---------------------------------------------------------------------------

const LOCAL_HEADER_SIG = 0x04034b50;
const STREAM_CHUNK_SIZE = 64 * 1024;

interface StreamState {
  finished: boolean;
  totalExpanded: number;
  fail: (rejection: ArchiveRejection) => void;
}

/**
 * Decode one entry directly from its local-header slice, measuring *actual*
 * decompressed bytes. Uses a fresh sync `UnzipInflate` per entry (no shared
 * streaming-unzip machinery), which keeps per-archive overhead low while
 * still aborting the moment any budget is crossed.
 */
function streamEntry(
  entry: CdEntry,
  data: Uint8Array,
  dataStart: number,
  dataEnd: number,
  state: StreamState,
  limits: IngestLimits,
  signal: AbortSignal,
): void {
  let entryBytes = 0;
  const isXml = isXmlDocumentName(entry.name);
  const xmlChunks: Uint8Array[] = [];
  let xmlBytes = 0;

  const account = (chunk: Uint8Array, final: boolean): boolean => {
    entryBytes += chunk.byteLength;
    state.totalExpanded += chunk.byteLength;
    if (entryBytes > limits.maxExpandedEntryBytes) {
      state.fail(
        archiveRejection('per-entry-size', {
          entry: entry.name,
          limit: limits.maxExpandedEntryBytes,
          value: entryBytes,
        }),
      );
      return false;
    }
    if (state.totalExpanded > limits.maxExpandedBytes) {
      state.fail(
        archiveRejection('expanded-size', {
          limit: limits.maxExpandedBytes,
          value: state.totalExpanded,
        }),
      );
      return false;
    }
    if (isXml) {
      const chunkBytes = chunk.byteLength;
      if (xmlBytes + chunkBytes > limits.maxXmlDocumentBytes) {
        state.fail(
          archiveRejection('xml-budget', {
            entry: entry.name,
            limit: limits.maxXmlDocumentBytes,
            value: xmlBytes + chunkBytes,
          }),
        );
        return false;
      }
      xmlBytes += chunkBytes;
      xmlChunks.push(chunk);
      if (final) {
        const single = xmlChunks[0];
        const merged = single && xmlChunks.length === 1 ? single : mergeChunks(xmlChunks, xmlBytes);
        const text = XML_TEXT_DECODER.decode(merged);
        const budgetRejection = checkXmlDocumentBudget(text, limits);
        if (budgetRejection) {
          state.fail({ ...budgetRejection, entry: entry.name });
          return false;
        }
      }
    }
    return true;
  };

  if (entry.method === 0) {
    // Stored entry: the compressed bytes ARE the expanded bytes.
    if (!account(data.subarray(dataStart, dataEnd), true)) return;
    return;
  }

  const decoder = new UnzipInflate();
  decoder.ondata = (err, chunk, final) => {
    if (state.finished) return;
    if (err) {
      state.fail(archiveRejection('invalid-archive'));
      return;
    }
    if (!account(chunk, final)) return;
  };
  try {
    for (let offset = dataStart; offset < dataEnd; offset += STREAM_CHUNK_SIZE) {
      if (state.finished || signal.aborted) break;
      const end = offset + STREAM_CHUNK_SIZE >= dataEnd;
      decoder.push(data.subarray(offset, Math.min(offset + STREAM_CHUNK_SIZE, dataEnd)), end);
    }
  } catch {
    state.fail(archiveRejection('invalid-archive'));
  }
}

function runStreamingValidation(
  data: Uint8Array,
  cd: CentralDirectory,
  limits: IngestLimits,
  signal: AbortSignal,
): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const state: StreamState = {
    finished: false,
    totalExpanded: 0,
    fail: (rejection) => {
      if (state.finished) return;
      state.finished = true;
      reject(new ArchiveRejectionError(rejection));
    },
  };

  let localOffset = 0;
  try {
    for (const entry of cd.entries) {
      if (state.finished) break;
      if (signal.aborted) {
        state.fail(archiveRejection('timeout'));
        break;
      }
      if (entry.isDirectory) continue;

      if (localOffset + 30 > data.byteLength || readU32(data, localOffset) !== LOCAL_HEADER_SIG) {
        state.fail(archiveRejection('invalid-archive'));
        break;
      }
      const localNameLen = readU16(data, localOffset + 26);
      const localExtraLen = readU16(data, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const dataEnd = dataStart + entry.compressedSize;
      if (dataEnd > data.byteLength) {
        state.fail(archiveRejection('invalid-archive'));
        break;
      }
      streamEntry(entry, data, dataStart, dataEnd, state, limits, signal);
      localOffset = dataEnd;
    }
    if (!state.finished) resolve();
  } catch {
    state.fail(archiveRejection('invalid-archive'));
  }
  return promise;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Validate an untrusted EPUB/ZIP archive against the documented ingest
 * limits. Resolves when safe; rejects with {@link ArchiveRejectionError}
 * (stable code, user-readable message) otherwise.
 */
export async function validateArchive(
  data: Uint8Array,
  options?: ArchiveValidationOptions,
): Promise<void> {
  const limits = resolveIngestLimits(options?.limits);
  const traceId = options?.traceId ?? createTraceId();
  try {
    await withTimeout((signal) => validateArchiveInner(data, limits, signal), {
      timeoutMs: options?.timeoutMs ?? limits.maxParseDurationMs,
      operation: 'archive-ingest',
      traceId,
    });
  } catch (error) {
    if (error instanceof ArchiveRejectionError) throw error;
    throw archiveRejectionFromError(error);
  }
}

async function validateArchiveInner(
  data: Uint8Array,
  limits: IngestLimits,
  signal: AbortSignal,
): Promise<void> {
  if (data.byteLength > limits.maxCompressedBytes) {
    throw new ArchiveRejectionError(
      archiveRejection('compressed-size', {
        limit: limits.maxCompressedBytes,
        value: data.byteLength,
      }),
    );
  }
  const cdOrRejection = parseCentralDirectory(data);
  if ('entries' in cdOrRejection) {
    const preflight = preflightCentralDirectory(cdOrRejection, limits);
    if (preflight) throw new ArchiveRejectionError(preflight);
    await runStreamingValidation(data, cdOrRejection, limits, signal);
  } else {
    throw new ArchiveRejectionError(cdOrRejection);
  }
}

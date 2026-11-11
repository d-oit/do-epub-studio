import { Unzip, UnzipInflate, UnzipPassThrough, type UnzipFile } from 'fflate';
import { ArchiveValidationError, validateArchive } from '../archive-validator';
import type { ZipEntry } from './zip';

const MIMETYPE = 'application/epub+zip';
export const SOURCE_MAX_COMPRESSED_BYTES = 8 * 1024 * 1024;
export const SOURCE_MAX_UNCOMPRESSED_BYTES = 16 * 1024 * 1024;
export const OUTPUT_MAX_COMPRESSED_BYTES = 10 * 1024 * 1024;
export const OUTPUT_MAX_UNCOMPRESSED_BYTES = 24 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 2_000;
const MAX_XML_BYTES = 2 * 1024 * 1024;

export const EPUB_ANNOTATION_EXPORT_LIMITS = {
  maxSourceCompressedBytes: SOURCE_MAX_COMPRESSED_BYTES,
  maxSourceUncompressedBytes: SOURCE_MAX_UNCOMPRESSED_BYTES,
  maxOutputCompressedBytes: OUTPUT_MAX_COMPRESSED_BYTES,
  maxOutputUncompressedBytes: OUTPUT_MAX_UNCOMPRESSED_BYTES,
  maxArchiveEntries: MAX_ARCHIVE_ENTRIES,
  maxAnnotations: 500,
  maxAnnotationTextBytes: 1024 * 1024,
} as const;

export type EpubAnnotationExportErrorCode =
  | 'SOURCE_TOO_LARGE'
  | 'SOURCE_UNSAFE'
  | 'SOURCE_INVALID'
  | 'ANNOTATIONS_TOO_LARGE'
  | 'ANNOTATIONS_INVALID'
  | 'OUTPUT_TOO_LARGE';

export class EpubAnnotationExportError extends Error {
  constructor(
    readonly code: EpubAnnotationExportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EpubAnnotationExportError';
  }
}

export interface SourceEntry extends ZipEntry {
  compression: number;
}

export interface UnzippedArchive {
  entries: SourceEntry[];
  expandedBytes: number;
}

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function safeArchiveName(name: string): boolean {
  if (
    name.length === 0 ||
    name.length > 1024 ||
    name.startsWith('/') ||
    name.startsWith('\\') ||
    name.includes('\\') ||
    name.includes('\0')
  ) {
    return false;
  }
  const path = name.endsWith('/') ? name.slice(0, -1) : name;
  if (path.length === 0) return false;
  for (const segment of path.split('/')) {
    if (segment.length === 0 || segment === '.' || segment === '..') return false;
  }
  return true;
}

export function archiveFailure(error: unknown): EpubAnnotationExportError {
  if (error instanceof EpubAnnotationExportError) return error;
  if (error instanceof ArchiveValidationError) {
    if (
      error.message.includes('maximum compressed size') ||
      error.message.includes('Total uncompressed size') ||
      error.message.includes('too many entries')
    ) {
      return new EpubAnnotationExportError('SOURCE_TOO_LARGE', error.message);
    }
    if (
      error.message.includes('Potential path traversal') ||
      error.message.includes('Compression ratio too high')
    ) {
      return new EpubAnnotationExportError('SOURCE_UNSAFE', error.message);
    }
    return new EpubAnnotationExportError('SOURCE_INVALID', error.message);
  }
  return new EpubAnnotationExportError(
    'SOURCE_INVALID',
    `The source EPUB cannot be safely read: ${error instanceof Error ? error.message : String(error)}`,
  );
}

export async function validateSourceArchive(bytes: Uint8Array): Promise<void> {
  if (bytes.byteLength > SOURCE_MAX_COMPRESSED_BYTES) {
    throw new EpubAnnotationExportError(
      'SOURCE_TOO_LARGE',
      'The source EPUB exceeds the 8 MiB limit',
    );
  }
  try {
    await validateArchive(bytes, {
      maxCompressedSize: SOURCE_MAX_COMPRESSED_BYTES,
      maxUncompressedSize: SOURCE_MAX_UNCOMPRESSED_BYTES,
      maxEntryCount: MAX_ARCHIVE_ENTRIES,
      maxCompressionRatio: 10,
    });
  } catch (error) {
    throw archiveFailure(error);
  }
}

export async function unzipSource(bytes: Uint8Array): Promise<UnzippedArchive> {
  return new Promise((resolve, reject) => {
    const entries: SourceEntry[] = [];
    const names = new Set<string>();
    const active = new Set<UnzipFile>();
    const unzip = new Unzip();
    let entryCount = 0;
    let declaredBytes = 0;
    let expandedBytes = 0;
    let pending = 0;
    let inputEnded = false;
    let settled = false;

    const fail = (error: EpubAnnotationExportError) => {
      if (settled) return;
      settled = true;
      for (const file of active) void file.terminate();
      reject(error);
    };
    const finishIfReady = () => {
      if (settled || !inputEnded || pending !== 0) return;
      if (entryCount === 0) {
        fail(new EpubAnnotationExportError('SOURCE_INVALID', 'The source EPUB archive is empty'));
        return;
      }
      settled = true;
      resolve({ entries, expandedBytes });
    };

    unzip.register(UnzipPassThrough);
    unzip.register(UnzipInflate);
    unzip.onfile = (file) => {
      if (settled) return;
      entryCount += 1;
      if (entryCount > MAX_ARCHIVE_ENTRIES) {
        fail(
          new EpubAnnotationExportError('SOURCE_TOO_LARGE', 'The source EPUB has too many entries'),
        );
        return;
      }
      if (!safeArchiveName(file.name)) {
        fail(
          new EpubAnnotationExportError(
            'SOURCE_UNSAFE',
            'The source EPUB contains an unsafe entry path',
          ),
        );
        return;
      }
      if (names.has(file.name)) {
        fail(
          new EpubAnnotationExportError(
            'SOURCE_UNSAFE',
            'The source EPUB contains duplicate entry paths',
          ),
        );
        return;
      }
      names.add(file.name);
      if (file.compression !== 0 && file.compression !== 8) {
        fail(
          new EpubAnnotationExportError(
            'SOURCE_UNSAFE',
            'The source EPUB uses unsupported compression',
          ),
        );
        return;
      }
      if (file.originalSize !== undefined) {
        declaredBytes += file.originalSize;
        if (declaredBytes > SOURCE_MAX_UNCOMPRESSED_BYTES) {
          fail(
            new EpubAnnotationExportError(
              'SOURCE_TOO_LARGE',
              'The source EPUB expands beyond 16 MiB',
            ),
          );
          return;
        }
      }

      pending += 1;
      active.add(file);
      const chunks: Uint8Array[] = [];
      let fileBytes = 0;
      file.ondata = (error, data, final) => {
        if (settled) return;
        if (error) {
          fail(
            new EpubAnnotationExportError(
              'SOURCE_INVALID',
              `Could not decompress source EPUB: ${error.message}`,
            ),
          );
          return;
        }
        if (data?.byteLength) {
          fileBytes += data.byteLength;
          expandedBytes += data.byteLength;
          if (expandedBytes > SOURCE_MAX_UNCOMPRESSED_BYTES) {
            fail(
              new EpubAnnotationExportError(
                'SOURCE_TOO_LARGE',
                'The source EPUB expands beyond 16 MiB',
              ),
            );
            return;
          }
          chunks.push(data);
        }
        if (!final) return;
        if (file.originalSize !== undefined && fileBytes !== file.originalSize) {
          fail(
            new EpubAnnotationExportError(
              'SOURCE_INVALID',
              'The source EPUB entry size does not match its ZIP metadata',
            ),
          );
          return;
        }
        const output = new Uint8Array(fileBytes);
        let offset = 0;
        for (const chunk of chunks) {
          output.set(chunk, offset);
          offset += chunk.byteLength;
        }
        entries.push({ name: file.name, data: output, compression: file.compression });
        active.delete(file);
        pending -= 1;
        finishIfReady();
      };
      try {
        file.start();
      } catch (error) {
        fail(
          new EpubAnnotationExportError(
            'SOURCE_INVALID',
            `Could not decompress source EPUB: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    };

    try {
      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < bytes.length && !settled; offset += chunkSize) {
        const end = offset + chunkSize >= bytes.length;
        unzip.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)), end);
      }
      inputEnded = true;
      finishIfReady();
    } catch (error) {
      fail(
        new EpubAnnotationExportError(
          'SOURCE_INVALID',
          `Could not read source EPUB archive: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  });
}

function isUtf8Bom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

function declaredEncoding(bytes: Uint8Array): string | null {
  if (bytes.length < 5 || bytes[0] !== 0x3c || bytes[1] !== 0x3f) return null;
  let prefix = '';
  const limit = Math.min(bytes.length, 256);
  for (let index = 0; index < limit; index += 1) {
    const value = bytes[index] as number;
    if (value === 0x3f && bytes[index + 1] === 0x3e) break;
    if (value > 0x7f) return null;
    prefix += String.fromCharCode(value);
  }
  const start = prefix.indexOf('encoding');
  if (start < 0) return null;
  let index = start + 'encoding'.length;
  while (prefix[index] === ' ' || prefix[index] === '\t') index += 1;
  if (prefix[index] !== '=') return null;
  index += 1;
  while (prefix[index] === ' ' || prefix[index] === '\t') index += 1;
  const quote = prefix[index];
  if (quote !== '"' && quote !== "'") return null;
  const valueStart = index + 1;
  const end = prefix.indexOf(quote, valueStart);
  return end < 0 ? null : prefix.slice(valueStart, end);
}

function normalizeXmlDeclaration(xml: string): string {
  if (!xml.startsWith('<?xml')) return xml;
  const declarationEnd = xml.indexOf('?>');
  if (declarationEnd < 0) return xml;
  const encodingStart = xml.indexOf('encoding', 0);
  if (encodingStart < 0 || encodingStart >= declarationEnd) return xml;
  let index = encodingStart + 'encoding'.length;
  while (xml[index] === ' ' || xml[index] === '\t') index += 1;
  if (xml[index] !== '=') return xml;
  index += 1;
  while (xml[index] === ' ' || xml[index] === '\t') index += 1;
  const quote = xml[index];
  if (quote !== '"' && quote !== "'") return xml;
  const valueStart = index + 1;
  const valueEnd = xml.indexOf(quote, valueStart);
  if (valueEnd < 0 || valueEnd > declarationEnd) return xml;
  return `${xml.slice(0, valueStart)}UTF-8${xml.slice(valueEnd)}`;
}

export function decodeXml(bytes: Uint8Array, fileName: string): string {
  if (bytes.byteLength > MAX_XML_BYTES) {
    throw new EpubAnnotationExportError(
      'SOURCE_TOO_LARGE',
      `${fileName} exceeds the XML size limit`,
    );
  }
  let encoding = declaredEncoding(bytes) ?? 'utf-8';
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
  else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
  else if (bytes.length >= 2 && bytes[0] === 0x3c && bytes[1] === 0) encoding = 'utf-16le';
  else if (bytes.length >= 2 && bytes[0] === 0 && bytes[1] === 0x3c) encoding = 'utf-16be';
  if (isUtf8Bom(bytes)) encoding = 'utf-8';
  try {
    return normalizeXmlDeclaration(new TextDecoder(encoding, { fatal: true }).decode(bytes));
  } catch (error) {
    throw new EpubAnnotationExportError(
      'SOURCE_INVALID',
      `Could not decode ${fileName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function getXmlSource(
  entries: ReadonlyMap<string, SourceEntry>,
  path: string | null,
  name: string,
): string | null {
  if (!path) return null;
  const entry = entries.get(path);
  if (!entry)
    throw new EpubAnnotationExportError('SOURCE_INVALID', `The source EPUB is missing ${name}`);
  return decodeXml(entry.data, name);
}

export function isMimetype(bytes: Uint8Array): boolean {
  if (bytes.byteLength !== MIMETYPE.length) return false;
  for (let index = 0; index < MIMETYPE.length; index += 1) {
    if (bytes[index] !== MIMETYPE.charCodeAt(index)) return false;
  }
  return true;
}

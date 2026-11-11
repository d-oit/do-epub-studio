import { Unzip } from 'fflate';
import { withTimeout } from './timeout';
import { createTraceId } from './telemetry';

export const MAX_COMPRESSED_SIZE = 100 * 1024 * 1024;
export const MAX_UNCOMPRESSED_SIZE = 1024 * 1024 * 1024;
export const MAX_ENTRY_COUNT = 10_000;
export const MAX_COMPRESSION_RATIO = 10;
const ARCHIVE_VALIDATION_TIMEOUT_MS = 10_000;

export class ArchiveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveValidationError';
  }
}

export interface ArchiveValidationOptions {
  timeoutMs?: number;
  traceId?: string;
  maxCompressedSize?: number;
  maxUncompressedSize?: number;
  maxEntryCount?: number;
  maxCompressionRatio?: number;
}

export async function validateArchive(
  data: Uint8Array,
  options?: ArchiveValidationOptions,
): Promise<void> {
  await withTimeout(
    (signal) =>
      validateArchiveInner(
        data,
        signal,
        options?.maxCompressedSize ?? MAX_COMPRESSED_SIZE,
        options?.maxUncompressedSize ?? MAX_UNCOMPRESSED_SIZE,
        options?.maxEntryCount ?? MAX_ENTRY_COUNT,
        options?.maxCompressionRatio ?? MAX_COMPRESSION_RATIO,
      ),
    {
      timeoutMs: options?.timeoutMs ?? ARCHIVE_VALIDATION_TIMEOUT_MS,
      operation: 'archive-validation',
      traceId: options?.traceId ?? createTraceId(),
    },
  );
}

function validateArchiveInner(
  data: Uint8Array,
  signal: AbortSignal,
  maxCompressedSize: number,
  maxUncompressedSize: number,
  maxEntryCount: number,
  maxCompressionRatio: number,
): Promise<void> {
  if (data.byteLength > maxCompressedSize) {
    throw new ArchiveValidationError(
      `Archive exceeds maximum compressed size of ${maxCompressedSize} bytes`,
    );
  }

  let entryCount = 0;
  let totalUncompressedSize = 0;
  let finished = false;

  return new Promise((resolve, reject) => {
    const unzip = new Unzip();
    unzip.onfile = (file) => {
      if (finished) return;
      if (signal.aborted) {
        finished = true;
        return;
      }
      entryCount += 1;
      if (entryCount > maxEntryCount) {
        finished = true;
        reject(
          new ArchiveValidationError(`Archive contains too many entries (max: ${maxEntryCount})`),
        );
        return;
      }
      const name = file.name;
      if (name.includes('..') || name.startsWith('/') || name.startsWith('\\')) {
        finished = true;
        reject(new ArchiveValidationError(`Potential path traversal detected in entry: ${name}`));
        return;
      }
      const uncompressed = file.originalSize;
      const compressed = file.size;
      if (uncompressed !== undefined && compressed !== undefined && compressed > 0) {
        const ratio = uncompressed / compressed;
        if (ratio > maxCompressionRatio) {
          finished = true;
          reject(
            new ArchiveValidationError(
              `Compression ratio too high for entry ${name}: ${ratio.toFixed(2)}:1`,
            ),
          );
          return;
        }
      }
      if (uncompressed !== undefined) {
        totalUncompressedSize += uncompressed;
        if (totalUncompressedSize > maxUncompressedSize) {
          finished = true;
          reject(
            new ArchiveValidationError(
              `Total uncompressed size exceeds limit of ${maxUncompressedSize} bytes`,
            ),
          );
        }
      }
    };

    const CHUNK_SIZE = 64 * 1024;
    try {
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        if (finished) break;
        const end = offset + CHUNK_SIZE >= data.length;
        unzip.push(data.subarray(offset, Math.min(offset + CHUNK_SIZE, data.length)), end);
      }
      if (!finished) {
        if (entryCount === 0)
          reject(new ArchiveValidationError('Failed to parse ZIP archive: No entries found'));
        else resolve();
      }
    } catch (error) {
      if (!finished) {
        finished = true;
        reject(
          new ArchiveValidationError(
            `Failed to parse ZIP archive: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }
  });
}

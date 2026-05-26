import { Unzip } from 'fflate';

export const MAX_COMPRESSED_SIZE = 100 * 1024 * 1024;
export const MAX_UNCOMPRESSED_SIZE = 1024 * 1024 * 1024;
export const MAX_ENTRY_COUNT = 10000;
export const MAX_COMPRESSION_RATIO = 10;

export class ArchiveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveValidationError';
  }
}

export async function validateArchive(data: Uint8Array): Promise<void> {
  if (data.length > MAX_COMPRESSED_SIZE) {
    throw new ArchiveValidationError(
      `Archive exceeds maximum compressed size of ${MAX_COMPRESSED_SIZE} bytes`,
    );
  }

  let entryCount = 0;
  let totalUncompressedSize = 0;
  let finished = false;

  return new Promise((resolve, reject) => {
    const unzip = new Unzip();

    unzip.onfile = (file) => {
      if (finished) return;

      entryCount++;
      if (entryCount > MAX_ENTRY_COUNT) {
        finished = true;
        reject(
          new ArchiveValidationError(
            `Archive contains too many entries (max: ${MAX_ENTRY_COUNT})`,
          ),
        );
        return;
      }

      const name = file.name;
      if (name.includes('..') || name.startsWith('/') || name.startsWith('\\')) {
        finished = true;
        reject(
          new ArchiveValidationError(
            `Potential path traversal detected in entry: ${name}`,
          ),
        );
        return;
      }

      if (file.originalSize !== undefined && file.size !== undefined && file.size > 0) {
        const ratio = file.originalSize / file.size;
        if (ratio > MAX_COMPRESSION_RATIO) {
          finished = true;
          reject(
            new ArchiveValidationError(
              `Compression ratio too high for entry ${name}: ${ratio.toFixed(2)}:1`,
            ),
          );
          return;
        }
        totalUncompressedSize += file.originalSize;
        if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
          finished = true;
          reject(
            new ArchiveValidationError(
              `Total uncompressed size exceeds limit of ${MAX_UNCOMPRESSED_SIZE} bytes`,
            ),
          );
          return;
        }
      } else if (file.originalSize !== undefined) {
        totalUncompressedSize += file.originalSize;
        if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
          finished = true;
          reject(
            new ArchiveValidationError(
              `Total uncompressed size exceeds limit of ${MAX_UNCOMPRESSED_SIZE} bytes`,
            ),
          );
        }
      }
    };

    try {
      unzip.push(data, true);
      if (!finished) {
        if (entryCount === 0) {
          reject(new ArchiveValidationError('Failed to parse ZIP archive: No entries found'));
        } else {
          resolve();
        }
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

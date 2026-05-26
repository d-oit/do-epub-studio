/// <reference lib="WebWorker" />

import { Unzip } from 'fflate';

const MAX_COMPRESSED_SIZE = 100 * 1024 * 1024;
const MAX_UNCOMPRESSED_SIZE = 1024 * 1024 * 1024;
const MAX_ENTRY_COUNT = 10000;
const MAX_COMPRESSION_RATIO = 10;

interface ParseRequest {
  type: 'parse';
  id: string;
  source: string | Uint8Array;
}

interface ResultMessage {
  type: 'result';
  id: string;
  result: {
    valid: boolean;
    error?: string;
    data?: ArrayBuffer;
  };
}

function validateEpubArchive(data: Uint8Array): Promise<void> {
  if (data.length > MAX_COMPRESSED_SIZE) {
    return Promise.reject(
      new Error(`Archive exceeds maximum compressed size of ${MAX_COMPRESSED_SIZE} bytes`),
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
        reject(new Error(`Archive contains too many entries (max: ${MAX_ENTRY_COUNT})`));
        return;
      }

      const name = file.name;
      if (name.includes('..') || name.startsWith('/') || name.startsWith('\\')) {
        finished = true;
        reject(new Error(`Potential path traversal detected in entry: ${name}`));
        return;
      }

      if (file.originalSize !== undefined && file.size !== undefined && file.size > 0) {
        const ratio = file.originalSize / file.size;
        if (ratio > MAX_COMPRESSION_RATIO) {
          finished = true;
          reject(
            new Error(
              `Compression ratio too high for entry ${name}: ${ratio.toFixed(2)}:1`,
            ),
          );
          return;
        }
        totalUncompressedSize += file.originalSize;
        if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
          finished = true;
          reject(
            new Error(
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
            new Error(
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
          reject(new Error('Failed to parse ZIP archive: No entries found'));
        } else {
          resolve();
        }
      }
    } catch (error) {
      if (!finished) {
        finished = true;
        reject(
          new Error(
            `Failed to parse ZIP archive: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }
  });
}

self.onmessage = async (event: MessageEvent<ParseRequest>) => {
  const { type, id, source } = event.data;

  if (type === 'parse') {
    try {
      let data: Uint8Array;

      if (typeof source === 'string') {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        data = new Uint8Array(buffer);
      } else {
        data = source;
      }

      await validateEpubArchive(data);

      const msg: ResultMessage = {
        type: 'result',
        id,
        result: {
          valid: true,
          data: data.buffer as ArrayBuffer,
        },
      };
      self.postMessage(msg, [data.buffer]);
    } catch (error) {
      const msg: ResultMessage = {
        type: 'result',
        id,
        result: {
          valid: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
      self.postMessage(msg);
    }
  }
};

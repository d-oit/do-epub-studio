import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';

const FIXED_ZIP_DATE = new Date(1980, 0, 1, 0, 0, 0);
declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

const CRC32_TABLE = new Uint32Array(256);
for (let code = 0; code < CRC32_TABLE.length; code++) {
  let value = code;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC32_TABLE[code] = value >>> 0;
}

export function crc32(data: Uint8Array): number {
  let checksum = 0xffffffff;
  for (const byte of data) {
    const tableIndex = (checksum ^ byte) & 0xff; // The mask fits the 256-entry lookup table.
    checksum = (CRC32_TABLE[tableIndex] as number) ^ (checksum >>> 8);
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  store?: boolean;
}

/**
 * Builds an EPUB-compatible ZIP with `mimetype` as the first stored entry.
 * Fixed entry timestamps and pinned compression make identical inputs stable.
 */
export function buildZip(
  entries: readonly ZipEntry[],
  options: { maxOutputBytes?: number } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  if (entries[0]?.name !== 'mimetype' || !entries[0].store) {
    throw new TypeError('EPUB ZIP must start with an uncompressed mimetype entry');
  }

  const { promise, resolve, reject } = Promise.withResolvers<Uint8Array<ArrayBuffer>>();
  const chunks: Uint8Array[] = [];
  let outputSize = 0;
  let settled = false;
  let zip: Zip | null = null;
  try {
    zip = new Zip((error, data, final) => {
      if (settled) return;
      if (error) {
        settled = true;
        zip?.terminate();
        reject(error);
        return;
      }
      if (data) {
        outputSize += data.byteLength;
        if (options.maxOutputBytes !== undefined && outputSize > options.maxOutputBytes) {
          settled = true;
          zip?.terminate();
          reject(
            new RangeError(`ZIP output exceeds maximum size of ${options.maxOutputBytes} bytes`),
          );
          return;
        }
        chunks.push(data);
      }
      if (!final) return;

      settled = true;
      const output = new Uint8Array(outputSize);
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve(output);
    });

    for (const entry of entries) {
      const file = entry.store
        ? new ZipPassThrough(entry.name)
        : new ZipDeflate(entry.name, { level: 6 });
      file.mtime = FIXED_ZIP_DATE;
      file.os = 3;
      file.attrs = 0;
      zip.add(file);
      file.push(entry.data, true);
    }
    zip.end();
  } catch (error) {
    if (!settled) {
      settled = true;
      zip?.terminate();
      reject(error);
    }
  }
  return promise;
}

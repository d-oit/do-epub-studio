/**
 * Minimal raw ZIP builder for deterministic, in-repo EPUB generation.
 *
 * No external dependency: entries are stored (method 0) or raw-deflated
 * (method 8) via node:zlib — the same approach used by the #1434 corpus
 * generator. Produces byte-identical archives for identical inputs.
 *
 * The builder also exposes explicit corruption hooks used by the malformed /
 * adversarial corpus entries (truncation, traversal names, forged declared
 * sizes, trailing junk).
 */
import { deflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  /** 0 = stored, 8 = deflated. Defaults to 8. */
  method?: 0 | 8;
}

export interface BuildZipOptions {
  /**
   * Replace the uncompressed size declared in local + central headers for the
   * named entries with `usz` (bytes). The payload itself is unchanged, so the
   * archive is structurally inconsistent — some parsers reject it.
   */
  forgeDeclaredSizes?: Record<string, { usz: number }>;
  /** Drop the central directory and end-of-central-directory records. */
  truncateCentralDirectory?: boolean;
  /** Append garbage after the EOCD (simulates trailing data / polyglot). */
  trailingJunkBytes?: number;
  /** Omit the EOCD record entirely (unfinished archive). */
  omitEocd?: boolean;
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c;
}

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i] ?? 0;
    const folded = CRC_TABLE[(c ^ byte) & 0xff];
    c = (folded === undefined ? 0 : folded) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface PreparedEntry {
  name: string;
  nameBytes: Uint8Array;
  raw: Uint8Array;
  compressed: Uint8Array;
  method: 0 | 8;
  crc: number;
  csz: number;
  usz: number;
}

function prepareEntries(files: ZipEntry[]): PreparedEntry[] {
  return files.map((file) => {
    const raw = file.data;
    const method = file.method ?? 8;
    const compressed = method === 0 ? raw : deflateRawSync(raw);
    return {
      name: file.name,
      nameBytes: new TextEncoder().encode(file.name),
      raw,
      compressed,
      method,
      crc: crc32(raw),
      csz: compressed.length,
      usz: raw.length,
    };
  });
}

export function buildZip(files: ZipEntry[], options: BuildZipOptions = {}): Uint8Array {
  const entries = prepareEntries(files);
  const localBlocks: Uint8Array[] = [];
  const centralBlocks: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const usz = options.forgeDeclaredSizes?.[e.name]?.usz ?? e.usz;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6); // flags
    lh.writeUInt16LE(e.method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(e.crc, 14);
    lh.writeUInt32LE(e.csz, 18);
    lh.writeUInt32LE(usz, 22);
    lh.writeUInt16LE(e.nameBytes.length, 26);
    lh.writeUInt16LE(0, 28);
    localBlocks.push(lh, e.nameBytes, e.compressed);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(e.method, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(e.crc, 16);
    ch.writeUInt32LE(e.csz, 20);
    ch.writeUInt32LE(usz, 24);
    ch.writeUInt16LE(e.nameBytes.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centralBlocks.push(ch, e.nameBytes);

    offset += 30 + e.nameBytes.length + e.compressed.length;
  }

  const body = Buffer.concat(localBlocks);
  if (options.truncateCentralDirectory) return body;

  const centralDir = Buffer.concat(centralBlocks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  const tail = options.omitEocd ? centralDir : Buffer.concat([centralDir, eocd]);
  const junk = options.trailingJunkBytes ? Buffer.alloc(options.trailingJunkBytes, 0x7f) : null;
  return Buffer.concat(junk ? [body, tail, junk] : [body, tail]);
}

/** First local header offset for an entry name (or -1). */
export function findLocalEntryOffset(zip: Uint8Array, name: string): number {
  const needle = new TextEncoder().encode(name);
  const buf = Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength);
  let pos = 0;
  while (pos + 4 <= buf.length) {
    if (buf.readUInt32LE(pos) !== 0x04034b50) break;
    const nameLen = buf.readUInt16LE(pos + 26);
    const extLen = buf.readUInt16LE(pos + 28);
    const nameBytes = buf.subarray(pos + 30, pos + 30 + nameLen);
    if (nameBytes.length === needle.length && nameBytes.equals(needle)) return pos;
    const csz = buf.readUInt32LE(pos + 18);
    pos += 30 + nameLen + extLen + csz;
  }
  return -1;
}

/** Local header ordered names — used to assert the mimetype-first rule. */
export function listLocalEntryNames(zip: Uint8Array): string[] {
  const buf = Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength);
  const names: string[] = [];
  let pos = 0;
  while (pos + 4 <= buf.length) {
    if (buf.readUInt32LE(pos) !== 0x04034b50) break;
    const nameLen = buf.readUInt16LE(pos + 26);
    const extLen = buf.readUInt16LE(pos + 28);
    names.push(buf.subarray(pos + 30, pos + 30 + nameLen).toString('utf8'));
    const csz = buf.readUInt32LE(pos + 18);
    pos += 30 + nameLen + extLen + csz;
  }
  return names;
}

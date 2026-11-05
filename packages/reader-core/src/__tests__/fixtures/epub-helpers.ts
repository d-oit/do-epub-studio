import type { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';

const CENTRAL_DIR_HEADER_SIG = 0x02014b50;

export function readZipEntries(buf: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();

  let eocdPos = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) return entries;

  const cdOffset = buf.readUInt32LE(eocdPos + 16);
  const numEntries = buf.readUInt16LE(eocdPos + 10);

  let cdPos = cdOffset;
  for (let i = 0; i < numEntries; i++) {
    if (buf.readUInt32LE(cdPos) !== CENTRAL_DIR_HEADER_SIG) break;

    const fnLen = buf.readUInt16LE(cdPos + 28);
    const extLen = buf.readUInt16LE(cdPos + 30);
    const localOffset = buf.readUInt32LE(cdPos + 42);

    const fn = buf.subarray(cdPos + 46, cdPos + 46 + fnLen).toString('utf-8');

    const lfhNameLen = buf.readUInt16LE(localOffset + 26);
    const lfhExtLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lfhNameLen + lfhExtLen;
    const localCompSize = buf.readUInt32LE(localOffset + 18);
    const localCompMethod = buf.readUInt16LE(localOffset + 8);

    const dataSlice = buf.subarray(dataStart, dataStart + localCompSize);

    if (localCompMethod === 0) {
      entries.set(fn, dataSlice);
    } else if (localCompMethod === 8) {
      entries.set(fn, inflateRawSync(dataSlice));
    } else {
      entries.set(fn, dataSlice);
    }

    cdPos += 46 + fnLen + extLen;
  }

  return entries;
}

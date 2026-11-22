import { describe, expect, it } from 'vitest';
import { buildZip, crc32, findLocalEntryOffset, listLocalEntryNames, type ZipEntry } from './zip';

const utf8 = (s: string) => new TextEncoder().encode(s);

function sampleFiles(): ZipEntry[] {
  return [
    { name: 'mimetype', data: utf8('application/epub+zip'), method: 0 },
    { name: 'OEBPS/chapter1.xhtml', data: utf8('<html><body>hello</body></html>') },
  ];
}

describe('corpus zip builder', () => {
  it('is byte-identical on repeated generation', () => {
    const a = buildZip(sampleFiles());
    const b = buildZip(sampleFiles());
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('keeps mimetype first when stored', () => {
    const zip = buildZip(sampleFiles());
    expect(listLocalEntryNames(zip)[0]).toBe('mimetype');
    expect(findLocalEntryOffset(zip, 'mimetype')).toBe(0);
    expect(findLocalEntryOffset(zip, 'OEBPS/chapter1.xhtml')).toBeGreaterThan(0);
    expect(findLocalEntryOffset(zip, 'absent')).toBe(-1);
  });

  it('computes CRC32 matching the zlib reference', () => {
    expect(crc32(utf8('123456789'))).toBe(0xcbf43926);
  });

  it('supports truncation and forged declared sizes', () => {
    const truncated = buildZip(sampleFiles(), { truncateCentralDirectory: true });
    expect(findLocalEntryOffset(truncated, 'mimetype')).toBe(0);
    const forged = buildZip(sampleFiles(), {
      forgeDeclaredSizes: { 'OEBPS/chapter1.xhtml': { usz: 0x7fffffff } },
    });
    // The forged size lives in both local and central headers; the local one
    // is readable at the entry offset.
    const offset = findLocalEntryOffset(forged, 'OEBPS/chapter1.xhtml');
    expect(offset).toBeGreaterThan(0);
    const buf = Buffer.from(forged.buffer, forged.byteOffset, forged.byteLength);
    expect(buf.readUInt32LE(offset + 22)).toBe(0x7fffffff);
  });
});

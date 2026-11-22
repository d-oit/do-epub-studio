import { describe, it, expect } from 'vitest';
import type { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';
import { buildMultilingualEpub, MULTILINGUAL_FIXTURES } from '../multilingual-epub-factory';

/**
 * Structural verification of the deterministic multilingual fixture builder
 * (issue #1491). Keeps the factory itself covered by the testkit suite and
 * guarantees every fixture is a valid, parseable EPUB archive.
 */

function readZipEntries(buf: Buffer): Map<string, Buffer> {
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
  let pos = cdOffset;
  for (let i = 0; i < numEntries; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const fnLen = buf.readUInt16LE(pos + 28);
    const extLen = buf.readUInt16LE(pos + 30);
    const fn = buf.subarray(pos + 46, pos + 46 + fnLen).toString('utf-8');
    const localOffset = buf.readUInt32LE(pos + 42);
    const lfhNameLen = buf.readUInt16LE(localOffset + 26);
    const lfhExtLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lfhNameLen + lfhExtLen;
    const compSize = buf.readUInt32LE(localOffset + 18);
    const compMethod = buf.readUInt16LE(localOffset + 8);
    let data = buf.subarray(dataStart, dataStart + compSize);
    if (compMethod === 8) data = inflateRawSync(data);
    entries.set(fn, data);
    pos += 46 + fnLen + extLen;
  }
  return entries;
}

describe('multilingual epub factory', () => {
  it.each(MULTILINGUAL_FIXTURES)(
    '%s produces a valid EPUB archive with expected core entries',
    (id) => {
      const buf = buildMultilingualEpub(id);
      const entries = readZipEntries(buf);

      expect(entries.get('mimetype')?.toString('utf8')).toBe('application/epub+zip');
      expect(entries.has('META-INF/container.xml')).toBe(true);
      expect(entries.has('content.opf')).toBe(true);
      expect(entries.has('nav.xhtml')).toBe(true);
      expect(entries.has('chapter1.xhtml')).toBe(true);
      expect(entries.has('chapter2.xhtml')).toBe(true);

      const opf = entries.get('content.opf')?.toString('utf8') ?? '';
      const nav = entries.get('nav.xhtml')?.toString('utf8') ?? '';
      const chapter1 = entries.get('chapter1.xhtml')?.toString('utf8') ?? '';

      expect(opf).toContain('<dc:language>');
      expect(opf).toContain('unique-identifier="book-id"');
      expect(nav).toContain('epub:type="toc"');
      expect(chapter1).toContain('<body>');
    },
  );

  it('declares RTL page progression for the Arabic and Hebrew fixtures', () => {
    for (const id of ['ar-rtl', 'he-rtl'] as const) {
      const opf =
        readZipEntries(buildMultilingualEpub(id)).get('content.opf')?.toString('utf8') ?? '';
      expect(opf).toContain('page-progression-direction="rtl"');
    }
  });

  it('embeds vertical writing CSS and ruby markup where expected', () => {
    const ja =
      readZipEntries(buildMultilingualEpub('ja-vertical'))
        .get('chapter1.xhtml')
        ?.toString('utf8') ?? '';
    expect(ja).toContain('writing-mode: vertical-rl');
    expect(ja).toContain('<ruby>');
    expect(ja).toContain('<rt>');

    const zh =
      readZipEntries(buildMultilingualEpub('zh-ruby')).get('chapter1.xhtml')?.toString('utf8') ??
      '';
    expect(zh).toContain('<ruby>');
    expect(zh).toContain('<rt>');
  });

  it('is deterministic byte-for-byte per fixture', () => {
    for (const id of MULTILINGUAL_FIXTURES) {
      const first = buildMultilingualEpub(id);
      const second = buildMultilingualEpub(id);
      expect(first.equals(second), `${id} stable bytes`).toBe(true);
    }
  });
});

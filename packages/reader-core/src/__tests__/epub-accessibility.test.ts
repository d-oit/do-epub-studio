/* eslint-disable @typescript-eslint/no-non-null-assertion -- test assertions */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';
import { parseAccessibilityFromOpf } from '../epub-accessibility';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

function findEocd(buf: Buffer): number {
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b &&
        buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}

function readZipEntries(buf: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const eocdPos = findEocd(buf);
  if (eocdPos === -1) return entries;

  const cdOffset = buf.readUInt32LE(eocdPos + 16);
  const numEntries = buf.readUInt16LE(eocdPos + 10);

  let pos = cdOffset;
  for (let i = 0; i < numEntries; i++) {
    const sig = buf.readUInt32LE(pos);
    if (sig !== 0x02014b50) break;

    const fnLen = buf.readUInt16LE(pos + 28);
    const extLen = buf.readUInt16LE(pos + 30);
    const fn = buf.subarray(pos + 46, pos + 46 + fnLen).toString('utf-8');
    const localOffset = buf.readUInt32LE(pos + 42);

    const lfhNameLen = buf.readUInt16LE(localOffset + 26);
    const lfhExtLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lfhNameLen + lfhExtLen;
    const localCompSize = buf.readUInt32LE(localOffset + 18);
    const localCompMethod = buf.readUInt16LE(localOffset + 8);

    let data = buf.subarray(dataStart, dataStart + localCompSize);
    if (localCompMethod === 8) {
      data = inflateRawSync(data);
    }
    entries.set(fn, data);

    pos += 46 + fnLen + extLen;
  }
  return entries;
}

function extractAttrs(xml: string, tag: string, attr: string): string[] {
  const results: string[] = [];
  const tagRegex = new RegExp(`<${tag}([^>]*)>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(xml)) !== null) {
    const attrRegex = new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, 'i');
    const am = attrRegex.exec(m[1]!);
    if (am) results.push(am[1]!);
  }
  return results;
}

function readEpubFixture(name: string): Buffer {
  return readFileSync(resolve(FIXTURES, name));
}

function getOpfXml(buf: Buffer): string {
  const entries = readZipEntries(buf);
  const containerStr = entries.get('META-INF/container.xml')?.toString('utf-8') ?? '';
  const opfPath = extractAttrs(containerStr, 'rootfile', 'full-path')[0] ?? '';
  return entries.get(opfPath)?.toString('utf-8') ?? '';
}

describe('parseAccessibilityFromOpf', () => {
  it('extracts full accessibility metadata from OPF', () => {
    const buf = readEpubFixture('accessibility.epub');
    const opfXml = getOpfXml(buf);
    const result = parseAccessibilityFromOpf(opfXml);

    expect(result.summary).toBe('This book is fully accessible with structural navigation and alternative text.');
    expect(result.features).toEqual(
      expect.arrayContaining(['structuralNavigation', 'tableOfContents', 'alternativeText']),
    );
    expect(result.features).toHaveLength(3);
    expect(result.hazards).toEqual(['none']);
    expect(result.controls).toEqual(['fullKeyboardControl']);
    expect(result.api).toBe('ARIA');
    expect(result.conformsTo).toBe('EPUB Accessibility 1.1');
  });

  it('handles minimal accessibility metadata', () => {
    const buf = readEpubFixture('accessibility-minimal.epub');
    const opfXml = getOpfXml(buf);
    const result = parseAccessibilityFromOpf(opfXml);

    expect(result.summary).toBeUndefined();
    expect(result.features).toEqual([]);
    expect(result.hazards).toEqual(['flashing', 'sound']);
    expect(result.controls).toEqual([]);
    expect(result.api).toBeUndefined();
    expect(result.conformsTo).toBeUndefined();
  });

  it('returns empty defaults for OPF with no accessibility metadata', () => {
    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
  </metadata>
</package>`;
    const result = parseAccessibilityFromOpf(opfXml);
    expect(result.summary).toBeUndefined();
    expect(result.features).toEqual([]);
    expect(result.hazards).toEqual([]);
    expect(result.controls).toEqual([]);
    expect(result.api).toBeUndefined();
    expect(result.conformsTo).toBeUndefined();
  });

  it('handles empty OPF string', () => {
    const result = parseAccessibilityFromOpf('');
    expect(result.features).toEqual([]);
    expect(result.hazards).toEqual([]);
    expect(result.controls).toEqual([]);
  });

  it('handles malformed OPF XML gracefully', () => {
    const result = parseAccessibilityFromOpf('not xml at all');
    expect(result.features).toEqual([]);
    expect(result.hazards).toEqual([]);
  });

  it('handles very long OPF input', () => {
    const long = 'a'.repeat(1048577);
    const result = parseAccessibilityFromOpf(long);
    expect(result.features).toEqual([]);
    expect(result.hazards).toEqual([]);
  });

  it('handles self-closing meta tags with content attribute', () => {
    const opfXml = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test</dc:title>
    <meta property="schema:accessibilitySummary" content="Test summary"/>
    <meta property="schema:accessibilityFeature" content="structuralNavigation"/>
  </metadata>
</package>`;
    const result = parseAccessibilityFromOpf(opfXml);
    expect(result.summary).toBe('Test summary');
    expect(result.features).toEqual(['structuralNavigation']);
  });

  it('deduplicates identical features', () => {
    const opfXml = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test</dc:title>
    <meta property="schema:accessibilityFeature">structuralNavigation</meta>
    <meta property="schema:accessibilityFeature">structuralNavigation</meta>
    <meta property="schema:accessibilityFeature">tableOfContents</meta>
  </metadata>
</package>`;
    const result = parseAccessibilityFromOpf(opfXml);
    expect(result.features).toHaveLength(2);
    expect(result.features).toEqual(expect.arrayContaining(['structuralNavigation', 'tableOfContents']));
  });

  it('extracts certification metadata', () => {
    const opfXml = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test</dc:title>
    <meta property="a11y:certifiedBy">Benetech</meta>
    <meta property="a11y:certifierCredential">Certified by DAISY</meta>
    <meta property="a11y:certifierReport">https://example.com/report</meta>
  </metadata>
</package>`;
    const result = parseAccessibilityFromOpf(opfXml);
    expect(result.certifiedBy).toBe('Benetech');
    expect(result.certifierCredential).toBe('Certified by DAISY');
    expect(result.certifierReport).toBe('https://example.com/report');
  });

  it('parses hazards from minimal EPUB fixture', () => {
    const buf = readEpubFixture('minimal.epub');
    const opfXml = getOpfXml(buf);
    const result = parseAccessibilityFromOpf(opfXml);
    expect(result.summary).toBeUndefined();
    expect(result.features).toEqual([]);
    expect(result.hazards).toEqual([]);
  });

  it('handles meta with name attribute instead of property', () => {
    const opfXml = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test</dc:title>
    <meta name="schema:accessibilityFeature" content="structuralNavigation"/>
  </metadata>
</package>`;
    const result = parseAccessibilityFromOpf(opfXml);
    expect(result.features).toEqual(['structuralNavigation']);
  });
});

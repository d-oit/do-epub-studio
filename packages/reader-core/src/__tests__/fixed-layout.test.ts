import { describe, expect, it } from 'vitest';
import { parseFixedLayoutFromOpf, isFixedLayout } from '../fixed-layout';

describe('parseFixedLayoutFromOpf', () => {
  it('returns undefined for empty OPF', () => {
    expect(parseFixedLayoutFromOpf('')).toBeUndefined();
  });

  it('returns undefined for OPF with no rendition metadata', () => {
    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
  </metadata>
</package>`;
    expect(parseFixedLayoutFromOpf(opfXml)).toBeUndefined();
  });

  it('detects pre-paginated layout', () => {
    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Fixed Layout Book</dc:title>
    <meta property="rendition:layout">pre-paginated</meta>
  </metadata>
</package>`;
    const result = parseFixedLayoutFromOpf(opfXml);
    expect(result).toBeDefined();
    expect(result?.layout).toBe('pre-paginated');
  });

  it('detects reflowable layout', () => {
    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Reflowable Book</dc:title>
    <meta property="rendition:layout">reflowable</meta>
  </metadata>
</package>`;
    const result = parseFixedLayoutFromOpf(opfXml);
    expect(result).toBeDefined();
    expect(result?.layout).toBe('reflowable');
  });

  it('parses orientation and spread', () => {
    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Fixed Layout Book</dc:title>
    <meta property="rendition:layout">pre-paginated</meta>
    <meta property="rendition:orientation">landscape</meta>
    <meta property="rendition:spread">none</meta>
  </metadata>
</package>`;
    const result = parseFixedLayoutFromOpf(opfXml);
    expect(result).toBeDefined();
    expect(result?.layout).toBe('pre-paginated');
    expect(result?.orientation).toBe('landscape');
    expect(result?.spread).toBe('none');
  });

  it('parses spread with both value', () => {
    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Fixed Layout Book</dc:title>
    <meta property="rendition:layout">pre-paginated</meta>
    <meta property="rendition:spread">both</meta>
  </metadata>
</package>`;
    const result = parseFixedLayoutFromOpf(opfXml);
    expect(result?.spread).toBe('both');
  });

  it('parses spread with landscape value', () => {
    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Fixed Layout Book</dc:title>
    <meta property="rendition:layout">pre-paginated</meta>
    <meta property="rendition:spread">landscape</meta>
  </metadata>
</package>`;
    const result = parseFixedLayoutFromOpf(opfXml);
    expect(result?.spread).toBe('landscape');
  });

  it('parses viewport from rendition metadata', () => {
    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Fixed Layout Book</dc:title>
    <meta property="rendition:layout">pre-paginated</meta>
    <meta property="rendition:viewport">width=1024,height=768</meta>
  </metadata>
</package>`;
    const result = parseFixedLayoutFromOpf(opfXml);
    expect(result?.viewport).toBe('width=1024,height=768');
  });

  it('handles self-closing meta tags with content attribute', () => {
    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Fixed Layout Book</dc:title>
    <meta property="rendition:layout" content="pre-paginated"/>
    <meta property="rendition:viewport" content="width=1024,height=768"/>
  </metadata>
</package>`;
    const result = parseFixedLayoutFromOpf(opfXml);
    expect(result?.layout).toBe('pre-paginated');
    expect(result?.viewport).toBe('width=1024,height=768');
  });

  it('handles very long OPF input', () => {
    const long = 'a'.repeat(1048577);
    const result = parseFixedLayoutFromOpf(long);
    expect(result).toBeUndefined();
  });

  it('ignores invalid layout values', () => {
    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Book</dc:title>
    <meta property="rendition:layout">invalid-value</meta>
  </metadata>
</package>`;
    const result = parseFixedLayoutFromOpf(opfXml);
    expect(result?.layout).toBeUndefined();
  });
});

describe('isFixedLayout', () => {
  it('returns true for pre-paginated layout', () => {
    expect(isFixedLayout({ layout: 'pre-paginated' })).toBe(true);
  });

  it('returns false for reflowable layout', () => {
    expect(isFixedLayout({ layout: 'reflowable' })).toBe(false);
  });

  it('returns false when no layout is set', () => {
    expect(isFixedLayout({ orientation: 'landscape' })).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isFixedLayout(undefined)).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  normalizeRootfilePath,
  parseContainerXml,
  extractOpfMetadataSummary,
  deriveRenditionLabel,
  resolveRenditions,
  ContainerParsingError,
  MAX_CONTAINER_BYTES,
} from '../rendition-container';

describe('normalizeRootfilePath', () => {
  it('normalizes valid publication paths', () => {
    expect(normalizeRootfilePath('OEBPS/content.opf')).toBe('OEBPS/content.opf');
    expect(normalizeRootfilePath('./OEBPS/content.opf')).toBe('OEBPS/content.opf');
    expect(normalizeRootfilePath('/OEBPS/alternate.opf')).toBe('OEBPS/alternate.opf');
    expect(normalizeRootfilePath('EPUB/package.opf')).toBe('EPUB/package.opf');
  });

  it('rejects empty paths', () => {
    expect(() => normalizeRootfilePath('')).toThrow(ContainerParsingError);
    expect(() => normalizeRootfilePath('   ')).toThrow(ContainerParsingError);
  });

  it('rejects remote protocols and schemes', () => {
    expect(() => normalizeRootfilePath('https://example.com/package.opf')).toThrow(
      ContainerParsingError,
    );
    expect(() => normalizeRootfilePath('http://example.com/package.opf')).toThrow(
      ContainerParsingError,
    );
    expect(() => normalizeRootfilePath('//example.com/package.opf')).toThrow(ContainerParsingError);
  });

  it('rejects absolute Windows drive letters', () => {
    expect(() => normalizeRootfilePath('C:\\package.opf')).toThrow(ContainerParsingError);
  });

  it('rejects paths that escape archive root', () => {
    expect(() => normalizeRootfilePath('../../outside.opf')).toThrow(ContainerParsingError);
    expect(() => normalizeRootfilePath('OEBPS/../../../escaped.opf')).toThrow(
      ContainerParsingError,
    );
  });
});

describe('parseContainerXml', () => {
  const multiRootfileContainer = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    <rootfile full-path="OEBPS/alternate.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  it('parses multiple rootfiles in declared order', () => {
    const entries = parseContainerXml(multiRootfileContainer);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      fullPath: 'OEBPS/content.opf',
      mediaType: 'application/oebps-package+xml',
    });
    expect(entries[1]).toEqual({
      fullPath: 'OEBPS/alternate.opf',
      mediaType: 'application/oebps-package+xml',
    });
  });

  it('rejects empty or oversized container XML', () => {
    expect(() => parseContainerXml('')).toThrow(ContainerParsingError);
    const oversized = `<container>${'a'.repeat(MAX_CONTAINER_BYTES + 1)}</container>`;
    expect(() => parseContainerXml(oversized)).toThrow(ContainerParsingError);
  });

  it('rejects container with no rootfiles', () => {
    const emptyContainer = `<container><rootfiles></rootfiles></container>`;
    expect(() => parseContainerXml(emptyContainer)).toThrow(ContainerParsingError);
  });
});

describe('extractOpfMetadataSummary and deriveRenditionLabel', () => {
  const reflowOpf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Main Edition</dc:title>
    <dc:language>en</dc:language>
    <meta property="rendition:layout">reflowable</meta>
  </metadata>
</package>`;

  const fixedOpf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Illustrated Edition</dc:title>
    <dc:language>ja</dc:language>
    <meta property="rendition:layout">pre-paginated</meta>
  </metadata>
</package>`;

  it('extracts metadata summary correctly', () => {
    const reflowSummary = extractOpfMetadataSummary(reflowOpf);
    expect(reflowSummary.title).toBe('Main Edition');
    expect(reflowSummary.language).toBe('en');
    expect(reflowSummary.layout).toBe('reflowable');

    const fixedSummary = extractOpfMetadataSummary(fixedOpf);
    expect(fixedSummary.title).toBe('Illustrated Edition');
    expect(fixedSummary.language).toBe('ja');
    expect(fixedSummary.layout).toBe('pre-paginated');
  });

  it('derives human-readable labels without exposing filesystem paths', () => {
    const reflowSummary = extractOpfMetadataSummary(reflowOpf);
    const label1 = deriveRenditionLabel(reflowSummary, 0, true);
    expect(label1).toBe('Reflowable (Default)');
    expect(label1).not.toContain('.opf');

    const fixedSummary = extractOpfMetadataSummary(fixedOpf);
    const label2 = deriveRenditionLabel(fixedSummary, 1, false);
    expect(label2).toBe('Fixed Layout');
    expect(label2).not.toContain('.opf');

    // Title fallback
    const titleOnly = deriveRenditionLabel({ title: 'Audio Edition' }, 1, false);
    expect(titleOnly).toBe('Audio Edition');
  });
});

describe('resolveRenditions', () => {
  const containerXml = `<container><rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    <rootfile full-path="OEBPS/alternate.opf" media-type="application/oebps-package+xml"/>
  </rootfiles></container>`;

  it('resolves all valid renditions with archive reader', async () => {
    const mockArchive = {
      getText: vi.fn().mockImplementation((path: string) => {
        if (path === 'OEBPS/content.opf') {
          return Promise.resolve(
            '<package><metadata><dc:title>Default View</dc:title></metadata></package>',
          );
        }
        if (path === 'OEBPS/alternate.opf') {
          return Promise.resolve(
            '<package><metadata><dc:title>Alternate View</dc:title></metadata></package>',
          );
        }
        return Promise.resolve(null);
      }),
    };

    const renditions = await resolveRenditions(containerXml, mockArchive);
    expect(renditions).toHaveLength(2);
    expect(renditions[0]?.isDefault).toBe(true);
    expect(renditions[0]?.label).toBe('Default View');
    expect(renditions[1]?.isDefault).toBe(false);
    expect(renditions[1]?.label).toBe('Alternate View');
  });

  it('omits invalid alternate package without blocking valid default', async () => {
    const mockArchive = {
      getText: vi.fn().mockImplementation((path: string) => {
        if (path === 'OEBPS/content.opf') {
          return Promise.resolve(
            '<package><metadata><dc:title>Default View</dc:title></metadata></package>',
          );
        }
        // Alternate is missing from archive
        return Promise.resolve(null);
      }),
    };

    const renditions = await resolveRenditions(containerXml, mockArchive);
    expect(renditions).toHaveLength(1);
    expect(renditions[0]?.fullPath).toBe('OEBPS/content.opf');
  });
});

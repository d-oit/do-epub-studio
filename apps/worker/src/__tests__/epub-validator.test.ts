import { describe, it, expect } from 'vitest';
import { validateEpub } from '@do-epub-studio/shared';
import JSZip from 'jszip';

describe('epub-validator', () => {
  it('should validate a correct EPUB structure', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    zip.file('OEBPS/content.opf', '<?xml version="1.0"?><package version="3.0" xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test</dc:title></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/></manifest><spine></spine></package>');

    const data = await zip.generateAsync({ type: 'arraybuffer' });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.epubVersion).toBe('3.0');
  });

  it('should fail if mimetype is missing', async () => {
    const zip = new JSZip();
    zip.file('META-INF/container.xml', '...');

    const data = await zip.generateAsync({ type: 'arraybuffer' });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing "mimetype" file.');
  });

  it('should fail if container.xml is missing', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');

    const data = await zip.generateAsync({ type: 'arraybuffer' });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing "META-INF/container.xml".');
  });

  it('should warn for non-EPUB 3 versions', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    zip.file('content.opf', '<?xml version="1.0"?><package version="2.0" xmlns="http://www.idpf.org/2007/opf"><metadata></metadata><spine></spine></package>');

    const data = await zip.generateAsync({ type: 'arraybuffer' });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('EPUB version is 2.0. Only EPUB 3.x is officially supported.');
  });
});

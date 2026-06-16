import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { validateEpub } from '../epub-validator';

async function createEpubZip(
  options: {
    includeMimetype?: boolean;
    mimetypeContent?: string;
    includeContainer?: boolean;
    containerContent?: string;
    includeOpf?: boolean;
    opfContent?: string;
    opfPath?: string;
  } = {},
): Promise<ArrayBuffer> {
  const zip = new JSZip();

  if (options.includeMimetype !== false) {
    zip.file('mimetype', options.mimetypeContent ?? 'application/epub+zip');
  }

  if (options.includeContainer !== false) {
    const opfPath = options.opfPath ?? 'OEBPS/content.opf';
    const containerContent =
      options.containerContent ??
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    zip.file('META-INF/container.xml', containerContent);
  }

  if (options.includeOpf !== false && options.opfPath !== 'missing/path.opf') {
    const opfContent =
      options.opfContent ??
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">test-book</dc:identifier>
    <dc:title>Test Book</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>
  </manifest>
  <spine/>
</package>`;
    zip.file(options.opfPath ?? 'OEBPS/content.opf', opfContent);
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('validateEpub', () => {
  it('returns valid for a well-formed EPUB', async () => {
    const data = await createEpubZip();
    const result = await validateEpub(data);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.epubVersion).toBe('3.0');
  });

  it('returns error when mimetype file is missing', async () => {
    const data = await createEpubZip({ includeMimetype: false });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing "mimetype" file.');
  });

  it('returns error when mimetype is invalid', async () => {
    const data = await createEpubZip({ mimetypeContent: 'application/pdf' });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Invalid mimetype');
  });

  it('returns error when container.xml is missing', async () => {
    const data = await createEpubZip({ includeContainer: false });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing "META-INF/container.xml".');
  });

  it('returns error when full-path is not found in container.xml', async () => {
    const data = await createEpubZip({
      containerContent: '<?xml version="1.0"?><container/>',
    });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Could not find rootfile path');
  });

  it('returns error when OPF file is not found at path', async () => {
    const data = await createEpubZip({ opfPath: 'missing/path.opf' });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('OPF file not found at path');
  });

  it('warns when EPUB version is not 3.x', async () => {
    const data = await createEpubZip({
      opfContent: `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata><dc:identifier>test</dc:identifier></metadata>
  <manifest/>
  <spine/>
</package>`,
    });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(true);
    expect(result.epubVersion).toBe('2.0');
    expect(result.warnings[0]).toContain('EPUB version is 2.0');
  });

  it('warns when EPUB version cannot be determined', async () => {
    const data = await createEpubZip({
      opfContent: `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf">
  <metadata><dc:identifier>test</dc:identifier></metadata>
  <manifest/>
  <spine/>
</package>`,
    });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(true);
    expect(result.warnings[0]).toContain('Could not determine EPUB version');
  });

  it('warns when no NAV or NCX is found', async () => {
    const data = await createEpubZip({
      opfContent: `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata><dc:identifier>test</dc:identifier></metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine/>
</package>`,
    });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('No NAV or NCX table of contents found.');
  });

  it('does not warn when NCX is present', async () => {
    const data = await createEpubZip({
      opfContent: `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata><dc:identifier>test</dc:identifier></metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine/>
</package>`,
    });
    const result = await validateEpub(data);

    expect(result.isValid).toBe(true);
    expect(result.warnings).not.toContain('No NAV or NCX table of contents found.');
  });

  it('returns error for invalid ZIP data', async () => {
    const invalidData = new Uint8Array([1, 2, 3, 4]).buffer;
    const result = await validateEpub(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Failed to parse EPUB archive');
  });
});

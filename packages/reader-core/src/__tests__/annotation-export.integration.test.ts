import { describe, expect, it } from 'vitest';
import { createEpubLoader } from '../epub-loader';
import { exportAnnotationsToEpub, type EpubExportAnnotation } from '../packager/annotation-export';
import { buildZip } from '../packager/zip';

const ENC = new TextEncoder();

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

const OPF3_XML = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:original-book</dc:identifier>
    <dc:title>Original Book</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch-1" href="chapters/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch-2" href="chapters/ch2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch-1"/>
    <itemref idref="ch-2"/>
  </spine>
</package>
`;

const NAV3_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
  <body>
    <nav epub:type="toc" id="toc"><h1>Contents</h1><ol><li><a href="chapters/ch1.xhtml">One</a></li><li><a href="chapters/ch2.xhtml">Two</a></li></ol></nav>
  </body>
</html>
`;

const CH1_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><body><p>Original chapter survives &amp; stays readable.</p></body></html>`;

const CH2_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><body><p>Two</p></body></html>`;

async function epub3Fixture(): Promise<Uint8Array> {
  return buildZip([
    { name: 'mimetype', data: ENC.encode('application/epub+zip'), store: true },
    { name: 'META-INF/container.xml', data: ENC.encode(CONTAINER_XML), store: true },
    { name: 'OEBPS/content.opf', data: ENC.encode(OPF3_XML), store: true },
    { name: 'OEBPS/nav.xhtml', data: ENC.encode(NAV3_XML), store: true },
    { name: 'OEBPS/chapters/ch1.xhtml', data: ENC.encode(CH1_XHTML), store: true },
    { name: 'OEBPS/chapters/ch2.xhtml', data: ENC.encode(CH2_XHTML), store: true },
  ]);
}

describe('annotation EPUB export reader integration', () => {
  it('loads the generated EPUB through the production reader and real EPUB parser', async () => {
    const annotations: EpubExportAnnotation[] = [
      {
        type: 'highlight',
        id: 'ann-1',
        body: 'selected',
        revisionId: 'rev-1',
        anchorStatus: 'anchored',
        chapterRef: 'chapters/ch1.xhtml',
        cfi: 'epubcfi(/6/2)',
        selectedText: 'selected',
      },
    ];
    const output = await exportAnnotationsToEpub(await epub3Fixture(), annotations, {
      revisionId: 'rev-1',
    });

    const loader = createEpubLoader();
    try {
      await loader.load(output);
      expect(loader.getBook()).not.toBeNull();

      const spineHrefs = loader.getSpineItems().map((item) => item.href);
      expect(spineHrefs).toContain('chapters/ch1.xhtml');
      expect(spineHrefs).toContain('chapters/ch2.xhtml');
      expect(spineHrefs[spineHrefs.length - 1]).toBe('annotations.xhtml');

      const tocHrefs = loader.getToc().map((item) => item.href);
      expect(tocHrefs).toContain('chapters/ch1.xhtml');
      expect(tocHrefs).toContain('chapters/ch2.xhtml');
      expect(tocHrefs).toContain('annotations.xhtml');
      expect(loader.getMetadata().title).toBe('Original Book');
    } finally {
      loader.destroy();
    }
  });
});

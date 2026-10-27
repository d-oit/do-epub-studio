// Generated, redistributable EPUB 3 sample for isolated preview demos (ADR-1014).
import { createRequire } from 'node:module';

const workerRequire = createRequire(new URL('../../apps/worker/package.json', import.meta.url));
export const SAMPLE_TITLE = 'Demo Book';
export const SAMPLE_TEXT = 'Welcome to the demo';

export async function createDemoEpub() {
  const JSZip = workerRequire('jszip');
  const zip = new JSZip();
  // ZIP's DOS timestamp epoch: stable archive bytes make reseeds idempotent.
  const archiveDate = new Date(Date.UTC(1980, 0, 1));
  const add = (name, text) => zip.file(name, text, { date: archiveDate, createFolders: false });
  add('mimetype', 'application/epub+zip');
  add(
    'META-INF/container.xml',
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>
<rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
</rootfiles></container>`,
  );
  add(
    'EPUB/package.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:do-epub-studio:demo:v1</dc:identifier>
<dc:title>${SAMPLE_TITLE}</dc:title><dc:creator>Demo Author</dc:creator><dc:language>en</dc:language>
<meta property="dcterms:modified">${archiveDate.toISOString().replace('.000Z', 'Z')}</meta></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="start" href="start.xhtml" media-type="application/xhtml+xml"/>
<item id="next" href="next.xhtml" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="start"/><itemref idref="next"/></spine></package>`,
  );
  add(
    'EPUB/nav.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en"><head><title>Contents</title></head>
<body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="start.xhtml">Start</a></li>
<li><a href="next.xhtml">Try annotations</a></li></ol></nav></body></html>`,
  );
  add(
    'EPUB/start.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Start</title></head>
<body><h1>${SAMPLE_TEXT}</h1><p>This sample book belongs to the preview demo. Read a chapter, select text, and explore the reader.</p>
<p><a href="next.xhtml">Continue to the next chapter</a></p></body></html>`,
  );
  add(
    'EPUB/next.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><title>Try annotations</title></head>
<body><h1>Try annotations</h1><p>Select this sentence to add a highlight or comment.</p></body></html>`,
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

import { bench, describe } from 'vitest';
import { JSDOM } from 'jsdom';
import { createLocator, parseLocator, locatorToString } from './locator';
import { reanchorByText } from './reanchor';
import { sanitizeEpubDocument } from './sanitizer';
import { createEpubLoader } from './epub-loader';

// ---------------------------------------------------------------------------
// Helpers — synthetic EPUB document builder
// ---------------------------------------------------------------------------

function buildSyntheticDoc(nodeCount: number): Document {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
  const doc = dom.window.document;
  const body = doc.body;

  for (let i = 0; i < nodeCount; i++) {
    let el: Element;
    const r = i % 7;
    if (r === 0) {
      el = doc.createElement('div');
      el.setAttribute('id', `sec-${i}`);
      el.setAttribute('class', 'chapter');
    } else if (r === 1) {
      el = doc.createElement('p');
      el.textContent = `Paragraph ${i} with some content to fill the DOM.`;
    } else if (r === 2) {
      el = doc.createElement('a');
      el.setAttribute('href', `chapter${i}.xhtml`);
    } else if (r === 3) {
      el = doc.createElement('span');
      el.setAttribute('style', 'font-weight:bold');
    } else if (r === 4) {
      el = doc.createElement('img');
      el.setAttribute('src', `img${i}.png`);
      el.setAttribute('alt', `Image ${i}`);
    } else if (r === 5) {
      el = doc.createElement('h2');
      el.textContent = `Section ${i}`;
    } else {
      el = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('viewBox', '0 0 100 100');
    }
    body.appendChild(el);
  }
  return doc;
}

// ---------------------------------------------------------------------------
// Existing benchmarks — locator & reanchor
// ---------------------------------------------------------------------------

describe('reader-core performance', () => {
  const cfi = 'epubcfi(/6/4!/2/2)';
  const text = 'The quick brown fox jumps over the lazy dog.';
  const chapterHref = 'chapter1.xhtml';
  const locator = createLocator(cfi, text, chapterHref);
  const locatorStr = locatorToString(locator);

  bench('locator: create', () => {
    createLocator(cfi, text, chapterHref);
  });

  bench('locator: parse', () => {
    parseLocator(locatorStr);
  });

  bench('locator: toString', () => {
    locatorToString(locator);
  });

  describe('reanchorByText', () => {
    const targetText = 'The quick brown fox jumps over the lazy dog.';
    const toc = [
      { id: '1', label: 'Chapter 1', href: 'ch1.xhtml' },
      { id: '2', label: 'Chapter 2', href: 'ch2.xhtml', subitems: [{ id: '2.1', label: 'Section 2.1', href: 'ch2-1.xhtml' }] },
      { id: '3', label: 'Chapter 3', href: 'ch3.xhtml' },
    ];
    function mockLoadContent(href: string): Promise<string> {
      if (href === 'ch3.xhtml') return Promise.resolve('Some other content here.');
      if (href === 'ch2-1.xhtml') return Promise.resolve('The quick brown fox jumps over the lazy dog.');
      return Promise.resolve('Nothing interesting here.');
    }

    bench('reanchor: Pass 1 (exact match in subitem)', async () => {
      await reanchorByText(targetText, toc, mockLoadContent);
    });

    const targetTextFuzzy = 'The fast brown fox leaps over a sleepy dog.';
    bench('reanchor: Pass 2 (fuzzy match)', async () => {
      await reanchorByText(targetTextFuzzy, toc, mockLoadContent);
    });

    describe('stress tests', () => {
      const LARGE_TEXT = 'The quick brown fox jumps over the lazy dog. '.repeat(4000);
      const stressToc = [{ id: '1', label: 'Large Chapter', href: 'large.xhtml' }];
      function stressLoadContent(): Promise<string> { return Promise.resolve(LARGE_TEXT); }
      const stressTarget = 'The fast brown fox leaps over a sleepy dog but it is quite long and has many words to check overlap with.';

      bench('reanchor: Pass 2 Stress (200KB, many words)', async () => {
        await reanchorByText(stressTarget, stressToc, stressLoadContent);
      });

      const TOC_WITH_ANCHORS = Array.from({ length: 50 }, (_, i) => ({
        id: i.toString(),
        label: `Section ${i}`,
        href: `large.xhtml#sec${i}`
      }));

      bench('reanchor: 50 anchors in 1 chapter (caching test)', async () => {
        await reanchorByText('No match', TOC_WITH_ANCHORS, stressLoadContent);
      });
    });
  });

  // -----------------------------------------------------------------------
  // sanitizeEpubDocument — full 3-pass pipeline at various DOM sizes
  // -----------------------------------------------------------------------

  describe('sanitizeEpubDocument', () => {
    const sizes = [
      { name: 'small (100 nodes)', count: 100 },
      { name: 'medium (1000 nodes)', count: 1000 },
      { name: 'large (5000 nodes)', count: 5000 },
    ] as const;

    for (const { name, count } of sizes) {
      bench(`sanitizeEpubDocument: ${name}`, () => {
        const doc = buildSyntheticDoc(count);
        sanitizeEpubDocument(doc);
      });
    }
  });

  // -----------------------------------------------------------------------
  // createEpubLoader — creation + parse flow
  // -----------------------------------------------------------------------

  describe('createEpubLoader', () => {
    bench('createEpubLoader (no load)', () => {
      createEpubLoader();
    });

    bench('createEpubLoader + load small EPUB', async () => {
      const loader = createEpubLoader();
      // Build a minimal valid EPUB in-memory using fflate
      const { zipSync } = await import('fflate');
      const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
      const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Bench EPUB</dc:title>
    <dc:identifier id="uid">urn:uuid:bench-001</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;
      const chapter1 = `<!DOCTYPE html><html><head><title>Ch1</title></head><body><h1>Chapter 1</h1><p>Hello world from benchmark EPUB.</p></body></html>`;
      const chapter2 = `<!DOCTYPE html><html><head><title>Ch2</title></head><body><h1>Chapter 2</h1><p>Second chapter content.</p></body></html>`;
      const navXhtml = `<!DOCTYPE html><html><head><title>Nav</title></head><body><nav epub:type="toc"><ol><li><a href="ch1.xhtml">Chapter 1</a></li><li><a href="ch2.xhtml">Chapter 2</a></li></ol></nav></body></html>`;

      const epubZip = zipSync({
        'mimetype': new Uint8Array([]),
        'META-INF/container.xml': new TextEncoder().encode(containerXml),
        'OEBPS/content.opf': new TextEncoder().encode(contentOpf),
        'OEBPS/ch1.xhtml': new TextEncoder().encode(chapter1),
        'OEBPS/ch2.xhtml': new TextEncoder().encode(chapter2),
        'OEBPS/nav.xhtml': new TextEncoder().encode(navXhtml),
      });

      await loader.load(epubZip);
      loader.destroy();
    });
  });
});

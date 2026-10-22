import { bench, beforeAll, describe } from 'vitest';
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
      {
        id: '2',
        label: 'Chapter 2',
        href: 'ch2.xhtml',
        subitems: [{ id: '2.1', label: 'Section 2.1', href: 'ch2-1.xhtml' }],
      },
      { id: '3', label: 'Chapter 3', href: 'ch3.xhtml' },
    ];
    const FUZZY_TARGET = 'important concepts key ideas topic discussion';
    const FUZZY_CONTENT = 'The chapter discusses important concepts and key ideas about the topic.';
    const FUZZY_TOC = [{ id: 'fuzzy', label: 'Fuzzy chapter', href: 'fuzzy.xhtml' }];
    const LARGE_TEXT = `${FUZZY_CONTENT} `.repeat(2800);
    const stressToc = [{ id: '1', label: 'Large Chapter', href: 'large.xhtml' }];
    const ROOT_COUNT = 500;
    const CHILDREN_PER_ROOT = 10;
    const TRAVERSAL_TARGET = 'last child target phrase';
    const LAST_CHILD_HREF = `root-${ROOT_COUNT - 1}-child-${CHILDREN_PER_ROOT - 1}.xhtml`;

    function mockLoadContent(href: string): Promise<string> {
      if (href === 'ch3.xhtml') return Promise.resolve('Some other content here.');
      if (href === 'ch2-1.xhtml')
        return Promise.resolve('The quick brown fox jumps over the lazy dog.');
      if (href === 'fuzzy.xhtml') return Promise.resolve(FUZZY_CONTENT);
      return Promise.resolve('Nothing interesting here.');
    }

    function stressLoadContent(): Promise<string> {
      return Promise.resolve(LARGE_TEXT);
    }

    const TOC_WITH_ANCHORS = Array.from({ length: 50 }, (_, i) => ({
      id: i.toString(),
      label: `Section ${i}`,
      href: `large.xhtml#sec${i}`,
    }));

    const traversalToc = Array.from({ length: ROOT_COUNT }, (_, rootIndex) => ({
      id: `root-${rootIndex}`,
      label: `Root ${rootIndex}`,
      href: `root-${rootIndex}.xhtml`,
      subitems: Array.from({ length: CHILDREN_PER_ROOT }, (_, childIndex) => ({
        id: `root-${rootIndex}-child-${childIndex}`,
        label: `Child ${childIndex}`,
        href: `root-${rootIndex}-child-${childIndex}.xhtml`,
      })),
    }));

    function traversalLoadContent(href: string): Promise<string> {
      return Promise.resolve(
        href === LAST_CHILD_HREF
          ? `The ${TRAVERSAL_TARGET} appears here.`
          : 'An unrelated chapter with no matching words.',
      );
    }

    beforeAll(async () => {
      const fuzzyResult = await reanchorByText(FUZZY_TARGET, FUZZY_TOC, mockLoadContent);
      if (!fuzzyResult.success || fuzzyResult.matchType !== 'fuzzy') {
        throw new Error('Fuzzy benchmark fixture did not produce a fuzzy match.');
      }

      const stressResult = await reanchorByText(FUZZY_TARGET, stressToc, stressLoadContent);
      if (!stressResult.success || stressResult.matchType !== 'fuzzy') {
        throw new Error('Large-content benchmark fixture did not produce a fuzzy match.');
      }

      let anchorLoadCount = 0;
      const anchorResult = await reanchorByText('missing target phrase', TOC_WITH_ANCHORS, () => {
        anchorLoadCount += 1;
        return Promise.resolve(LARGE_TEXT);
      });
      if (anchorResult.success || anchorLoadCount !== 1) {
        throw new Error('50-anchor benchmark fixture did not load its chapter exactly once.');
      }

      let traversalLoadCount = 0;
      const traversalResult = await reanchorByText(TRAVERSAL_TARGET, traversalToc, async (href) => {
        traversalLoadCount += 1;
        return traversalLoadContent(href);
      });
      if (
        !traversalResult.success ||
        traversalResult.chapterHref !== LAST_CHILD_HREF ||
        traversalLoadCount !== ROOT_COUNT * (CHILDREN_PER_ROOT + 1)
      ) {
        throw new Error('TOC traversal benchmark fixture did not reach its last child.');
      }
    });

    bench('reanchor: Pass 1 (exact match in subitem)', async () => {
      await reanchorByText(targetText, toc, mockLoadContent);
    });

    bench('reanchor: Pass 2 (fuzzy match)', async () => {
      await reanchorByText(FUZZY_TARGET, FUZZY_TOC, mockLoadContent);
    });

    describe('stress tests', () => {
      const stressTarget = FUZZY_TARGET;

      bench('reanchor: Pass 2 Stress (200KB, many words)', async () => {
        await reanchorByText(stressTarget, stressToc, stressLoadContent);
      });

      bench('reanchor: 50 anchors in 1 chapter (caching test)', async () => {
        await reanchorByText('missing target phrase', TOC_WITH_ANCHORS, stressLoadContent);
      });

      bench('reanchor: TOC traversal (500 roots, 10 children, last child)', async () => {
        await reanchorByText(TRAVERSAL_TARGET, traversalToc, traversalLoadContent);
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
      const doc = buildSyntheticDoc(count);
      bench(`sanitizeEpubDocument: ${name}`, () => {
        const clone = doc.cloneNode(true) as Document;
        sanitizeEpubDocument(clone);
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
        mimetype: new Uint8Array([]),
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

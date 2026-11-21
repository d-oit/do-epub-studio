/**
 * Per-fixture generators for the #1483 corpus (the `generateCorpusEntry`
 * switch plus fixture-specific spec/body builders). Kept separate from the
 * scaffolding builders so every file stays under the repo's 500-LOC cap.
 */
import { buildZip } from './zip';
import {
  buildEpubFromSpec,
  chapterBody,
  containerXml,
  opfXml,
  xhtmlDoc,
  type EpubSpec,
} from './generate';
import { generateMinimalTtf, generatePng, generateWav, prng } from './resources';

// ---------------------------------------------------------------------------
// Corpus entry generators
// ---------------------------------------------------------------------------

/** Standard three-chapter book spec used by most fixtures. */
function standardSpec(overrides: Omit<Partial<EpubSpec>, 'title'> & { title: string }): EpubSpec {
  return {
    version: '3.0',
    language: 'en',
    chapters: [1, 2, 3].map((i) => ({
      href: `chapter${i}.xhtml`,
      title: `Chapter ${i}`,
      body: xhtmlDoc(`<h1>Chapter ${i}</h1>\n${chapterBody(i * 7 + 1)}`, '<title>Chapter</title>'),
    })),
    ...overrides,
  };
}

function specWithBody(
  body: string,
  overrides: Omit<Partial<EpubSpec>, 'title'> & { title: string },
): EpubSpec {
  return {
    version: '3.0',
    language: 'en',
    chapters: [
      {
        href: 'chapter1.xhtml',
        title: 'Chapter 1',
        body: xhtmlDoc(body, '<title>Chapter</title>'),
      },
    ],
    ...overrides,
  };
}

const MEDIA_OVERLAY_SMIL = `<?xml version="1.0" encoding="UTF-8"?>
<smil xmlns="http://www.w3.org/ns/SMIL" version="3.0">
  <body>
    <seq id="overlay1" epub:type="media-overlay" xmlns:epub="http://www.idpf.org/2007/ops">
      <par><text src="chapter1.xhtml#p1"/><audio src="media/audio.wav"/></par>
      <par><text src="chapter1.xhtml#p2"/><audio src="media/audio.wav"/></par>
    </seq>
  </body>
</smil>`;

const ENCRYPTION_XML = `<?xml version="1.0" encoding="UTF-8"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
  <enc:EncryptedData Type="http://www.w3.org/2001/04/xmlenc#Element">
    <enc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/>
    <enc:CipherData>
      <enc:CipherReference URI="OEBPS/chapter1.xhtml"/>
    </enc:CipherData>
  </enc:EncryptedData>
</encryption>`;

const PNG_1PX = generatePng(1);
const TTF_CORPUS = generateMinimalTtf();
const WAV_CLIP = generateWav(2000);

function bigHugeAttr(seed: number): string {
  let s = seed >>> 0;
  let out = '';
  for (let i = 0; i < 4096; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    const n = s % 62;
    out += String.fromCharCode(n < 10 ? 48 + n : n < 36 ? 97 + n - 10 : 65 + n - 36);
  }
  return out;
}

function malformedBody(): string {
  return [
    '<custom-widget type="banner">Non-standard custom element</custom-widget>',
    '<marquee>Scrolling text</marquee>',
    '<div><span><em>Deeply nested but well-formed</em></span></div>',
    `<p data-huge="${bigHugeAttr(0x5eed)}">Text with a huge attribute</p>`,
    '<p>Unicode: \u200b zero-width space \ufeFF BOM \u2028 line sep \u2029 para sep</p>',
    '<p>Entities: &lt; &gt; &amp; &#x1F600;</p>',
    '<p>Non-standard elements and attributes are retained as inert markup</p>',
  ].join('\n');
}

function xxeBody(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>XXE</title></head>
<body><p>Before entity.</p><p>&xxe;</p><p>After entity.</p></body></html>`;
}

function scriptedBody(): string {
  return [
    '<script>alert("xss")</script>',
    '<style>body { display: none; }</style>',
    '<div onmouseover="evil()" onload="evil()" onclick="alert(1)">Event handlers</div>',
    '<button onclick="alert(1)">Click me</button>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" onclick="alert(1)"/></svg>',
  ].join('\n');
}

function svgScriptBody(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">',
    '  <script>alert("svg-xss")</script>',
    '  <rect width="100" height="100" onload="alert(2)" onclick="alert(3)"/>',
    '  <animate attributeName="x" from="0" to="100" onbegin="alert(4)"/>',
    '  <foreignObject><iframe src="https://invalid.example/"></iframe></foreignObject>',
    '</svg>',
  ].join('\n');
}

function unsafeSchemesBody(): string {
  return [
    '<a href="javascript:alert(1)">javascript</a>',
    '<a href="vbscript:msgbox(1)">vbscript</a>',
    '<a href="file:///etc/passwd">file</a>',
    '<a href="cid:not-a-real-cid">cid</a>',
    '<a href="data:text/plain,hello">data</a>',
    '<img src="data:text/html,<script>alert(1)</script>" alt="data uri"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml,<svg onload=alert(1)>"/></svg>',
  ].join('\n');
}

function urlEdgeCasesBody(): string {
  return [
    '<a href="java\nscript:alert(1)">newline in scheme</a>',
    '<a href="javas%63ript:alert(1)">percent-encoded scheme</a>',
    '<a href="\\javascript:alert(1)">backslash scheme</a>',
    '<a href="   javascript:alert(1)">whitespace prefix</a>',
    '<a href="JaVaScRiPt:alert(1)">mixed case</a>',
    '<img src="//evil.example/x.png" alt="scheme-relative"/>',
    '<a href="https://invalid.example/nav">absolute https link</a>',
  ].join('\n');
}

function rtlVerticalSpec(): EpubSpec {
  const style = '.vertical{writing-mode:vertical-rl;height:8rem}.rtl{direction:rtl}';
  const body =
    '<p class="vertical" lang="ja">縦書きのテスト。</p>\n' +
    '<p class="rtl" dir="rtl" lang="ar">نص تجريبي</p>';
  return {
    version: '3.0',
    title: 'RTL Vertical',
    language: 'ar',
    direction: 'rtl',
    chapters: [
      {
        href: 'chapter1.xhtml',
        title: 'Chapter 1',
        body: xhtmlDoc(
          `<h1>RTL Vertical</h1>\n${body}`,
          `<style>${style}</style><title>Chapter</title>`,
        ),
      },
    ],
  };
}

function svgContentSpec(): EpubSpec {
  const inlineSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" role="img" aria-labelledby="t">' +
    '<title id="t">A blue circle</title><circle cx="20" cy="20" r="12" fill="blue"/></svg>';
  const body = `<h1>SVG Content</h1>\n<p>Inline: ${inlineSvg}</p>\n<p>Referenced: <img src="vector.svg" alt="A vector"/></p>\n<p>Raster: <img src="pixel.png" alt="A pixel"/></p>`;
  return {
    version: '3.0',
    title: 'SVG Content',
    language: 'en',
    chapters: [
      {
        href: 'chapter1.xhtml',
        title: 'Chapter 1',
        body: xhtmlDoc(body, '<title>Chapter</title>'),
      },
    ],
    items: [
      {
        id: 'vector-svg',
        href: 'vector.svg',
        mediaType: 'image/svg+xml',
        data: new TextEncoder().encode(
          '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="green"/></svg>',
        ),
      },
      { id: 'pixel-png', href: 'pixel.png', mediaType: 'image/png', data: PNG_1PX },
    ],
  };
}

function fontSpec(): EpubSpec {
  const style =
    '@font-face{font-family:"Corpus Sans";src:url(fonts/corpus.ttf) format("truetype")} body{font-family:"Corpus Sans"}';
  const body = '<p>Font specimen: The quick brown fox.</p>';
  return {
    version: '3.0',
    title: 'Embedded Font',
    language: 'en',
    chapters: [
      {
        href: 'chapter1.xhtml',
        title: 'Chapter 1',
        body: xhtmlDoc(body, `<style>${style}</style><title>Chapter</title>`),
      },
    ],
    items: [
      { id: 'corpus-font', href: 'fonts/corpus.ttf', mediaType: 'font/ttf', data: TTF_CORPUS },
    ],
  };
}

function remoteResourcesSpec(): EpubSpec {
  const body =
    '<p>Remote references:</p>\n' +
    '<img src="https://invalid.example/never-request.png" alt="remote raster"/>' +
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://invalid.example/vector.svg"/></svg>';
  return {
    version: '3.0',
    title: 'Remote Resources',
    language: 'en',
    chapters: [
      {
        href: 'chapter1.xhtml',
        title: 'Chapter 1',
        body: xhtmlDoc(body, '<title>Chapter</title>'),
      },
    ],
  };
}

function mediaOverlaySpec(): EpubSpec {
  const body = '<p id="p1">First overlay paragraph.</p>\n<p id="p2">Second overlay paragraph.</p>';
  return {
    version: '3.0',
    title: 'Media Overlay',
    language: 'en',
    metadataExtras: ['    <meta property="media:duration" content="0:00:02"/>'],
    chapters: [
      {
        href: 'chapter1.xhtml',
        title: 'Chapter 1',
        body: xhtmlDoc(body, '<title>Chapter</title>'),
      },
    ],
    items: [
      {
        id: 'overlay-smil',
        href: 'media/overlay.smil',
        mediaType: 'application/smil+xml',
        data: new TextEncoder().encode(MEDIA_OVERLAY_SMIL),
      },
      { id: 'audio-wav', href: 'media/audio.wav', mediaType: 'audio/wav', data: WAV_CLIP },
    ],
    spineProperties: { ch1: 'media-overlay' },
  };
}

function annotationsSpec(): EpubSpec {
  const spans = [1, 2, 3]
    .map(
      (i) =>
        `<span id="marker-${i}" data-cfi="/4/${i * 2 + 2}" data-range-start="${i * 100}" data-range-end="${i * 100 + 40}" data-highlight-id="hl-${i}">Annotated passage ${i}.</span>`,
    )
    .join(' ');
  return {
    version: '3.0',
    title: 'Annotations',
    language: 'en',
    chapters: [
      {
        href: 'chapter1.xhtml',
        title: 'Chapter 1',
        body: xhtmlDoc(`<p>${spans}</p>`, '<title>Chapter</title>'),
      },
    ],
  };
}

function fixedLayoutSpec(): EpubSpec {
  return {
    version: '3.0',
    title: 'Fixed Layout',
    language: 'en',
    metadataExtras: [
      '    <meta property="rendition:layout" content="pre-paginated"/>',
      '    <meta property="rendition:viewport" content="1200x1600"/>',
    ],
    chapters: [1, 2].map((i) => ({
      href: `chapter${i}.xhtml`,
      title: `Chapter ${i}`,
      body: xhtmlDoc(`<h1>Fixed ${i}</h1>\n${chapterBody(i + 4)}`, '<title>Chapter</title>'),
    })),
    spineProperties: {
      ch1: 'rendition:layout-pre-paginated',
      ch2: 'rendition:layout-pre-paginated',
    },
  };
}

export function generateCorpusEntry(id: string): Uint8Array {
  switch (id) {
    case 'epub2-ncx':
      return buildEpubFromSpec(
        standardSpec({ title: 'Epub Two NCX', version: '2.0', includeNcx: true }),
      );
    case 'epub3-nav':
      return buildEpubFromSpec(standardSpec({ title: 'Epub Three Nav', includeNavDoc: true }));
    case 'multiple-rootfiles':
      return buildEpubFromSpec(
        standardSpec({
          title: 'Multiple Rootfiles',
          rootfiles: [
            { fullPath: 'OEBPS/content.opf', mediaType: 'application/oebps-package+xml' },
            { fullPath: 'OEBPS/alt.opf', mediaType: 'application/oebps-package+xml' },
          ],
        }),
      );
    case 'rtl-vertical':
      return buildEpubFromSpec(rtlVerticalSpec());
    case 'fixed-layout':
      return buildEpubFromSpec(fixedLayoutSpec());
    case 'svg-content':
      return buildEpubFromSpec(svgContentSpec());
    case 'embedded-font':
      return buildEpubFromSpec(fontSpec());
    case 'remote-resources':
      return buildEpubFromSpec(remoteResourcesSpec());
    case 'encrypted-resources':
      return buildEpubFromSpec(
        standardSpec({ title: 'Encrypted Resources', encryptionXml: ENCRYPTION_XML }),
      );
    case 'media-overlay':
      return buildEpubFromSpec(mediaOverlaySpec());
    case 'annotations':
      return buildEpubFromSpec(annotationsSpec());
    case 'malformed-content-unclosed':
      return buildEpubFromSpec(specWithBody(malformedBody(), { title: 'Malformed Content' }));
    case 'malformed-zip-truncated': {
      const data = buildZip(
        [
          { name: 'mimetype', data: new TextEncoder().encode('application/epub+zip'), method: 0 },
          {
            name: 'META-INF/container.xml',
            data: new TextEncoder().encode(
              containerXml([
                { fullPath: 'OEBPS/content.opf', mediaType: 'application/oebps-package+xml' },
              ]),
            ),
          },
          {
            name: 'OEBPS/chapter1.xhtml',
            data: new TextEncoder().encode('<html><body>cut</body></html>'),
          },
        ],
        { truncateCentralDirectory: true },
      );
      // Cut inside the last entry's payload: no EOCD and an incomplete
      // compressed stream — any ZIP parser must reject this.
      return data.subarray(0, Math.floor(data.length * 0.55));
    }
    case 'malformed-zip-declared-size':
      return buildZip(
        [
          { name: 'mimetype', data: new TextEncoder().encode('application/epub+zip'), method: 0 },
          { name: 'OEBPS/chapter1.xhtml', data: new TextEncoder().encode('<html/>') },
        ],
        { forgeDeclaredSizes: { 'OEBPS/chapter1.xhtml': { usz: 0x7fffffff } } },
      );
    case 'missing-mimetype':
      return buildZip([
        {
          name: 'META-INF/container.xml',
          data: new TextEncoder().encode(
            containerXml([
              { fullPath: 'OEBPS/content.opf', mediaType: 'application/oebps-package+xml' },
            ]),
          ),
        },
        {
          name: 'OEBPS/content.opf',
          data: new TextEncoder().encode(
            opfXml(
              standardSpec({ title: 'Missing Mimetype', version: '2.0', includeNcx: true }),
              'OEBPS/content.opf',
            ),
          ),
        },
      ]);
    case 'mimetype-not-first':
      return buildZip([
        {
          name: 'META-INF/container.xml',
          data: new TextEncoder().encode(
            containerXml([
              { fullPath: 'OEBPS/content.opf', mediaType: 'application/oebps-package+xml' },
            ]),
          ),
        },
        { name: 'mimetype', data: new TextEncoder().encode('application/epub+zip'), method: 0 },
        {
          name: 'OEBPS/content.opf',
          data: new TextEncoder().encode(
            opfXml(standardSpec({ title: 'Mimetype Not First' }), 'OEBPS/content.opf'),
          ),
        },
      ]);
    case 'xxe-external-entity':
      return buildEpubFromSpec(specWithBody(xxeBody(), { title: 'XXE' }));
    case 'malformed-zip-traversal':
      return buildZip([
        { name: 'mimetype', data: new TextEncoder().encode('application/epub+zip'), method: 0 },
        {
          name: 'META-INF/container.xml',
          data: new TextEncoder().encode(
            containerXml([
              { fullPath: 'OEBPS/content.opf', mediaType: 'application/oebps-package+xml' },
            ]),
          ),
        },
        {
          name: '../../evil.xhtml',
          data: new TextEncoder().encode('<html><body>evil</body></html>'),
        },
      ]);
    case 'zip-bomb-ratio': {
      const bomb = Buffer.alloc(64 * 1024 * 1024);
      return buildZip([
        { name: 'mimetype', data: new TextEncoder().encode('application/epub+zip'), method: 0 },
        { name: 'OEBPS/blob.bin', data: bomb },
      ]);
    }
    case 'oversized-resource': {
      const rng = prng(0xc0ffee);
      const blob = Buffer.alloc(1536 * 1024);
      for (let i = 0; i < blob.length; i += 4) {
        blob.writeUInt32LE(Math.floor(rng() * 0x100000000), i);
      }
      return buildEpubFromSpec(
        standardSpec({
          title: 'Oversized Resource',
          items: [
            { id: 'big-blob', href: 'blob.bin', mediaType: 'application/octet-stream', data: blob },
          ],
        }),
      );
    }
    case 'script-event-handlers':
      return buildEpubFromSpec(specWithBody(scriptedBody(), { title: 'Script Event Handlers' }));
    case 'svg-script':
      return buildEpubFromSpec(specWithBody(svgScriptBody(), { title: 'SVG Script' }));
    case 'unsafe-schemes':
      return buildEpubFromSpec(specWithBody(unsafeSchemesBody(), { title: 'Unsafe Schemes' }));
    case 'url-edge-cases':
      return buildEpubFromSpec(specWithBody(urlEdgeCasesBody(), { title: 'URL Edge Cases' }));
    default:
      throw new Error(`No generator for corpus fixture: ${id}`);
  }
}

/** Deterministic corpus build — always regenerates every fixture. */
export function buildCorpus(ids: readonly string[]): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  for (const id of ids) out.set(id, generateCorpusEntry(id));
  return out;
}

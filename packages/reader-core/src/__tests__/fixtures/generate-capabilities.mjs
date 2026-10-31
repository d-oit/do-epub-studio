import { mkdirSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createZip } from './zip-builder.mjs';

const output = resolve(dirname(fileURLToPath(import.meta.url)), 'capability-corpus');
const bytes = (text) => Buffer.from(text, 'utf8');
const navigation =
  '<nav epub:type="toc"><h1>Contents</h1><ol><li><a href="chapter.xhtml#start">Start</a></li></ol></nav><nav epub:type="landmarks"><h2>Landmarks</h2><ol><li><a epub:type="bodymatter" href="chapter.xhtml#start">Begin reading</a></li></ol></nav>';
const cases = [
  ['epub2-reflow', '2.0', '<h1 id="start">A Small Atlas</h1><p>A short original passage.</p>'],
  ['epub3-0-reflow-nav', '3.0', `${navigation}<h1 id="start">A Small Atlas</h1>`],
  ['epub3-1-reflow', '3.0', '<h1 id="start">A later reflow edition</h1>'],
  ['epub3-2-reflow', '3.0', '<h1 id="start">A later reflow edition</h1>'],
  ['epub3-3-reflow', '3.0', '<h1 id="start">A later reflow edition</h1>'],
  [
    'headings-landmarks-language',
    '3.0',
    `${navigation}<h1 id="start">A Small Atlas</h1><h2>North</h2><p lang="fr">Bonjour.</p>`,
  ],
  [
    'image-alternative',
    '3.0',
    '<h1 id="start">A Seed</h1><img src="seed.svg" alt="A round seed with two leaves"/>',
  ],
  [
    'complex-table',
    '3.0',
    '<h1 id="start">Rain log</h1><table><caption>Rain by season</caption><thead><tr><th id="season" scope="col">Season</th><th id="rain" scope="col">Millimetres</th></tr></thead><tbody><tr><th id="spring" scope="row">Spring</th><td headers="spring rain">12</td></tr></tbody></table>',
  ],
  ['ruby-annotation', '3.0', '<h1 id="start">Reading</h1><p><ruby>山<rt>やま</rt></ruby></p>'],
  [
    'mathml-equation',
    '3.0',
    '<h1 id="start">Balance</h1><math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow></math>',
  ],
  [
    'svg-vector',
    '3.0',
    '<h1 id="start">A blue circle</h1><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="label"><title id="label">A blue circle</title><circle cx="20" cy="20" r="12" fill="blue"/></svg>',
  ],
  ['vertical-writing', '3.0', '<h1 id="start">Vertical note</h1><p class="vertical">縦書き</p>'],
  ['rtl-direction', '3.0', '<h1 id="start">يمين</h1><p dir="rtl" lang="ar">نص تجريبي</p>'],
  ['media-overlay', '3.0', '<h1 id="start">A quiet line</h1><p id="line">Rain taps softly.</p>'],
  ['fixed-layout', '3.0', '<h1 id="start">Panel</h1><p>Fixed page text.</p>'],
  [
    'multiple-renditions',
    '3.0',
    '<h1 id="start">Two views</h1><p>One shared original sentence.</p>',
  ],
  [
    'scripted-content',
    '3.0',
    '<h1 id="start">No script</h1><button id="action" onclick="document.body.dataset.ran=\'yes\'">Press</button>',
  ],
  [
    'remote-resource',
    '3.0',
    '<h1 id="start">Local only</h1><img src="https://invalid.example/never-request.png" alt="Remote test resource"/>',
  ],
  [
    'dictionary-glossary',
    '3.0',
    '<h1 id="start">Word list</h1><dl><dt id="dew">Dew</dt><dd>Small drops of water on a cool surface.</dd></dl>',
  ],
  [
    'accessibility-metadata',
    '3.0',
    '<h1 id="start">Accessible claim sample</h1><p>Metadata is descriptive, not certification.</p>',
  ],
  [
    'malformed-navigation',
    '3.0',
    '<h1 id="start">Broken map</h1><p>Navigation target does not exist.</p>',
  ],
  [
    'epub34-preview',
    '3.0',
    '<h1 id="start">Forward-looking sample</h1><p>Uses only EPUB 3.3-era structures.</p>',
  ],
];

function epub([id, version, content]) {
  const malformed = id === 'malformed-navigation';
  const renditions =
    id === 'multiple-renditions'
      ? '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/><rootfile full-path="OEBPS/alternate.opf" media-type="application/oebps-package+xml"/>'
      : '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>';
  const epub2 = version === '2.0';
  const nav = malformed
    ? '<nav epub:type="toc"><h1>Contents</h1><ol><li><a href="missing.xhtml#absent">Missing</a></li></ol></nav>'
    : `<nav epub:type="toc"><h1>Contents</h1><ol><li><a href="chapter.xhtml#start">${id}</a></li></ol></nav>`;
  const packageMeta = `${id === 'fixed-layout' ? '<meta property="rendition:layout">pre-paginated</meta><meta property="rendition:orientation">portrait</meta>' : ''}${id === 'accessibility-metadata' ? '<meta property="schema:accessibilityFeature">structuralNavigation</meta><meta property="schema:accessibilitySummary">Synthetic metadata sample; not a certification.</meta><meta property="schema:accessibilityHazard">none</meta>' : ''}`;
  const mediaItems =
    id === 'media-overlay'
      ? '<item id="smil" href="overlay.smil" media-type="application/smil+xml"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" media-overlay="smil"/>'
      : '<item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>';
  const navManifest = epub2
    ? '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'
    : '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>';
  const tocAttribute = epub2 ? ' toc="ncx"' : '';
  const opf = `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="${version}" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:fixture:${id}</dc:identifier><dc:title>${id}</dc:title><dc:language>en</dc:language>${packageMeta}</metadata><manifest>${navManifest}${mediaItems}<item id="style" href="style.css" media-type="text/css"/></manifest><spine${tocAttribute}><itemref idref="chapter"/></spine></package>`;
  const chapter = `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en"><head><title>${id}</title><link rel="stylesheet" href="style.css"/></head><body>${content}</body></html>`;
  const entries = [
    ['mimetype', bytes('application/epub+zip'), true],
    [
      'META-INF/container.xml',
      bytes(
        `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>${renditions}</rootfiles></container>`,
      ),
    ],
    ['OEBPS/content.opf', bytes(opf)],
    [
      'OEBPS/nav.xhtml',
      bytes(
        `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body>${nav}</body></html>`,
      ),
    ],
    ['OEBPS/chapter.xhtml', bytes(chapter)],
    [
      'OEBPS/style.css',
      bytes(id === 'vertical-writing' ? '.vertical{writing-mode:vertical-rl}' : ''),
    ],
  ];
  if (epub2)
    entries.push([
      'OEBPS/toc.ncx',
      bytes(
        '<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head/><docTitle><text>epub2-reflow</text></docTitle><navMap><navPoint id="start" playOrder="1"><navLabel><text>Start</text></navLabel><content src="chapter.xhtml#start"/></navPoint></navMap></ncx>',
      ),
    ]);
  if (id === 'multiple-renditions')
    entries.push([
      'OEBPS/alternate.opf',
      bytes(opf.replace(`<dc:title>${id}</dc:title>`, '<dc:title>alternate-rendition</dc:title>')),
    ]);
  if (id === 'media-overlay')
    entries.push([
      'OEBPS/overlay.smil',
      bytes(
        '<smil xmlns="http://www.w3.org/ns/SMIL"><body><seq><par><text src="chapter.xhtml#line"/><audio src="silence.mp3" clipBegin="0s" clipEnd="1s"/></par></seq></body></smil>',
      ),
    ]);
  if (id === 'image-alternative')
    entries.push([
      'OEBPS/seed.svg',
      bytes(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="5"/></svg>',
      ),
    ]);
  return createZip(entries.map(([name, data, store]) => ({ name, data, store })));
}

mkdirSync(output, { recursive: true });
for (const fixture of cases) writeFileSync(resolve(output, `${fixture[0]}.epub`), epub(fixture));

import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createZip } from './zip-builder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function containerXml(opfPath) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function contentOpf(opts) {
  const metadata = [
    opts.title ? `<dc:title>${escapeXml(opts.title)}</dc:title>` : '',
    opts.author ? `<dc:creator>${escapeXml(opts.author)}</dc:creator>` : '',
    opts.language ? `<dc:language>${escapeXml(opts.language)}</dc:language>` : '',
    opts.identifier ? `<dc:identifier>${escapeXml(opts.identifier)}</dc:identifier>` : '',
  ]
    .filter(Boolean)
    .join('\n    ');

  const manifest = opts.manifest
    .map(
      (item) =>
        `    <item id="${escapeXml(item.id)}" href="${escapeXml(item.href)}" media-type="${escapeXml(item.mediaType)}"${item.properties ? ` properties="${escapeXml(item.properties)}"` : ''}/>`,
    )
    .join('\n');

  const spine = opts.spine
    .map(
      (item) =>
        `    <itemref idref="${escapeXml(item.idref)}"${item.properties ? ` properties="${escapeXml(item.properties)}"` : ''}/>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    ${metadata}
  </metadata>
  <manifest>
${manifest}
  </manifest>
  <spine>
${spine}
  </spine>
</package>`;
}

function navXhtml(items) {
  const links = items
    .map((item) => `      <li><a href="${escapeXml(item.href)}">${escapeXml(item.label)}</a></li>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
${links}
    </ol>
  </nav>
</body>
</html>`;
}

function sectionXhtml(id, content) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(id)}</title></head>
<body>
  <section id="${escapeXml(id)}">
    ${content}
  </section>
</body>
</html>`;
}

async function generateMinimalEpub() {
  return createZip([
    {
      name: 'mimetype',
      data: Buffer.from('application/epub+zip', 'utf-8'),
      store: true,
    },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8'),
    },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from(
        contentOpf({
          title: 'Minimal Test Book',
          author: 'Test Author',
          language: 'en',
          identifier: 'urn:uuid:test-001',
          manifest: [
            { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' },
            { id: 'section0001', href: 'section0001.xhtml', mediaType: 'application/xhtml+xml' },
          ],
          spine: [{ idref: 'section0001' }],
        }),
        'utf-8',
      ),
    },
    {
      name: 'OEBPS/nav.xhtml',
      data: Buffer.from(navXhtml([{ label: 'Start', href: 'section0001.xhtml' }]), 'utf-8'),
    },
    {
      name: 'OEBPS/section0001.xhtml',
      data: Buffer.from(sectionXhtml('section0001', '<p>Hello, EPUB world!</p>'), 'utf-8'),
    },
  ]);
}

async function generateNoMetadataEpub() {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf-8'), store: true },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8'),
    },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from(
        contentOpf({
          title: '',
          manifest: [
            { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml' },
            { id: 'section0001', href: 'section0001.xhtml', mediaType: 'application/xhtml+xml' },
          ],
          spine: [{ idref: 'nav', properties: 'nav' }, { idref: 'section0001' }],
        }),
        'utf-8',
      ),
    },
    {
      name: 'OEBPS/nav.xhtml',
      data: Buffer.from(navXhtml([{ label: 'Start', href: 'section0001.xhtml' }]), 'utf-8'),
    },
    {
      name: 'OEBPS/section0001.xhtml',
      data: Buffer.from(sectionXhtml('section0001', '<p>No metadata here</p>'), 'utf-8'),
    },
  ]);
}

async function generateNoSpineEpub() {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf-8'), store: true },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8'),
    },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>No Spine Book</dc:title>
    <dc:creator>Author</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml"/>
    <item id="section0001" href="section0001.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
  </spine>
</package>`,
        'utf-8',
      ),
    },
    {
      name: 'OEBPS/nav.xhtml',
      data: Buffer.from(sectionXhtml('empty', '<p>No spine</p>'), 'utf-8'),
    },
    {
      name: 'OEBPS/section0001.xhtml',
      data: Buffer.from(sectionXhtml('section0001', '<p>Not in spine</p>'), 'utf-8'),
    },
  ]);
}

async function generateMultiNavEpub() {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf-8'), store: true },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8'),
    },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from(
        contentOpf({
          title: 'Multi-Nav Book',
          author: 'Author',
          language: 'en',
          identifier: 'urn:uuid:multi-nav',
          manifest: [
            { id: 'nav1', href: 'nav1.xhtml', mediaType: 'application/xhtml+xml' },
            { id: 'nav2', href: 'nav2.xhtml', mediaType: 'application/xhtml+xml' },
            { id: 'content', href: 'content.xhtml', mediaType: 'application/xhtml+xml' },
          ],
          spine: [{ idref: 'nav1' }, { idref: 'nav2' }, { idref: 'content' }],
        }),
        'utf-8',
      ),
    },
    {
      name: 'OEBPS/nav1.xhtml',
      data: Buffer.from(navXhtml([{ label: 'Chapter A', href: 'content.xhtml' }]), 'utf-8'),
    },
    {
      name: 'OEBPS/nav2.xhtml',
      data: Buffer.from(navXhtml([{ label: 'Chapter B', href: 'content.xhtml' }]), 'utf-8'),
    },
    {
      name: 'OEBPS/content.xhtml',
      data: Buffer.from(sectionXhtml('content', '<p>Multiple navs</p>'), 'utf-8'),
    },
  ]);
}

async function generateInvalidMimetypeEpub() {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/octet-stream', 'utf-8'), store: true },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8'),
    },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from(
        contentOpf({
          title: 'Bad MIME',
          manifest: [
            { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml' },
            { id: 'section0001', href: 'section0001.xhtml', mediaType: 'application/xhtml+xml' },
          ],
          spine: [{ idref: 'nav', properties: 'nav' }, { idref: 'section0001' }],
        }),
        'utf-8',
      ),
    },
    {
      name: 'OEBPS/nav.xhtml',
      data: Buffer.from(navXhtml([{ label: 'Start', href: 'section0001.xhtml' }]), 'utf-8'),
    },
    {
      name: 'OEBPS/section0001.xhtml',
      data: Buffer.from(sectionXhtml('section0001', '<p>Bad MIME</p>'), 'utf-8'),
    },
  ]);
}

async function generateMissingContainerEpub() {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf-8'), store: true },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from(
        contentOpf({
          title: 'No Container',
          manifest: [
            { id: 'section0001', href: 'section0001.xhtml', mediaType: 'application/xhtml+xml' },
          ],
          spine: [{ idref: 'section0001' }],
        }),
        'utf-8',
      ),
    },
    {
      name: 'OEBPS/section0001.xhtml',
      data: Buffer.from(sectionXhtml('section0001', '<p>No container.xml</p>'), 'utf-8'),
    },
  ]);
}

function accessibilityOpf() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Accessible Test Book</dc:title>
    <dc:creator>A11y Author</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier>urn:uuid:a11y-test-001</dc:identifier>
    <meta property="schema:accessibilitySummary">This book is fully accessible with structural navigation and alternative text.</meta>
    <meta property="schema:accessibilityFeature">structuralNavigation</meta>
    <meta property="schema:accessibilityFeature">tableOfContents</meta>
    <meta property="schema:accessibilityFeature">alternativeText</meta>
    <meta property="schema:accessibilityHazard">none</meta>
    <meta property="schema:accessibilityControl">fullKeyboardControl</meta>
    <meta property="schema:accessibilityAPI">ARIA</meta>
    <meta property="dcterms:conformsTo">EPUB Accessibility 1.1</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml"/>
    <item id="section0001" href="section0001.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="nav" properties="nav"/>
    <itemref idref="section0001"/>
  </spine>
</package>`;
}

function accessibilityOpfMinimal() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Minimal A11y Book</dc:title>
    <dc:creator>A11y Author</dc:creator>
    <meta property="schema:accessibilityHazard">flashing</meta>
    <meta property="schema:accessibilityHazard">sound</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml"/>
    <item id="section0001" href="section0001.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="nav" properties="nav"/>
    <itemref idref="section0001"/>
  </spine>
</package>`;
}

async function generateAccessibilityEpub() {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf-8'), store: true },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8'),
    },
    { name: 'OEBPS/content.opf', data: Buffer.from(accessibilityOpf(), 'utf-8') },
    {
      name: 'OEBPS/nav.xhtml',
      data: Buffer.from(navXhtml([{ label: 'Start', href: 'section0001.xhtml' }]), 'utf-8'),
    },
    {
      name: 'OEBPS/section0001.xhtml',
      data: Buffer.from(sectionXhtml('section0001', '<p>Accessible content</p>'), 'utf-8'),
    },
  ]);
}

async function generateAccessibilityMinimalEpub() {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf-8'), store: true },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8'),
    },
    { name: 'OEBPS/content.opf', data: Buffer.from(accessibilityOpfMinimal(), 'utf-8') },
    {
      name: 'OEBPS/nav.xhtml',
      data: Buffer.from(navXhtml([{ label: 'Start', href: 'section0001.xhtml' }]), 'utf-8'),
    },
    {
      name: 'OEBPS/section0001.xhtml',
      data: Buffer.from(sectionXhtml('section0001', '<p>Minimal a11y</p>'), 'utf-8'),
    },
  ]);
}

async function main() {
  const generators = [
    ['minimal.epub', generateMinimalEpub],
    ['no-metadata.epub', generateNoMetadataEpub],
    ['no-spine.epub', generateNoSpineEpub],
    ['multi-nav.epub', generateMultiNavEpub],
    ['invalid-mimetype.epub', generateInvalidMimetypeEpub],
    ['missing-container.epub', generateMissingContainerEpub],
    ['accessibility.epub', generateAccessibilityEpub],
    ['accessibility-minimal.epub', generateAccessibilityMinimalEpub],
  ];

  for (const [filename, generator] of generators) {
    const buf = await generator();
    writeFileSync(resolve(__dirname, filename), buf);
    console.log(`Generated ${filename} (${buf.length} bytes)`);
  }
}

main().catch(console.error);

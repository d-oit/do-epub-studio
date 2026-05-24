import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function createZip(entries) {
  const localSegments = [];
  const centralSegments = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf-8');
    const data = entry.data;
    const crc = crc32(data);
    const fnLen = nameBuf.length;

    let compressed;
    let method;
    if (entry.store) {
      compressed = data;
      method = 0;
    } else {
      compressed = deflateRawSync(data);
      method = 8;
    }

    const compLen = compressed.length;
    const uncompLen = data.length;

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compLen, 18);
    lfh.writeUInt32LE(uncompLen, 22);
    lfh.writeUInt16LE(fnLen, 26);
    lfh.writeUInt16LE(0, 28);

    localSegments.push(lfh, nameBuf, compressed);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(CENTRAL_DIR_HEADER_SIG, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compLen, 20);
    cd.writeUInt32LE(uncompLen, 24);
    cd.writeUInt16LE(fnLen, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);

    centralSegments.push(cd, nameBuf);
    offset += 30 + fnLen + compLen;
  }

  const centralOffset = offset;
  const centralBuf = Buffer.concat(centralSegments);
  const centralSize = centralBuf.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localSegments, centralBuf, eocd]);
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
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
  ].filter(Boolean).join('\n    ');

  const manifest = opts.manifest.map((item) =>
    `    <item id="${escapeXml(item.id)}" href="${escapeXml(item.href)}" media-type="${escapeXml(item.mediaType)}"/>`
  ).join('\n');

  const spine = opts.spine.map((item) =>
    `    <itemref idref="${escapeXml(item.idref)}"${item.properties ? ` properties="${escapeXml(item.properties)}"` : ''}/>`
  ).join('\n');

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
  const links = items.map((item) =>
    `      <li><a href="${escapeXml(item.href)}">${escapeXml(item.label)}</a></li>`
  ).join('\n');

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
      data: Buffer.from(contentOpf({
        title: 'Minimal Test Book',
        author: 'Test Author',
        language: 'en',
        identifier: 'urn:uuid:test-001',
        manifest: [
          { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'section0001', href: 'section0001.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spine: [
          { idref: 'nav', properties: 'nav' },
          { idref: 'section0001' },
        ],
      }), 'utf-8'),
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
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8') },
    { name: 'OEBPS/content.opf', data: Buffer.from(contentOpf({
      title: '',
      manifest: [
        { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'section0001', href: 'section0001.xhtml', mediaType: 'application/xhtml+xml' },
      ],
      spine: [
        { idref: 'nav', properties: 'nav' },
        { idref: 'section0001' },
      ],
    }), 'utf-8') },
    { name: 'OEBPS/nav.xhtml', data: Buffer.from(navXhtml([{ label: 'Start', href: 'section0001.xhtml' }]), 'utf-8') },
    { name: 'OEBPS/section0001.xhtml', data: Buffer.from(sectionXhtml('section0001', '<p>No metadata here</p>'), 'utf-8') },
  ]);
}

async function generateNoSpineEpub() {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf-8'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8') },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
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
</package>`, 'utf-8'),
    },
    { name: 'OEBPS/nav.xhtml', data: Buffer.from(sectionXhtml('empty', '<p>No spine</p>'), 'utf-8') },
    { name: 'OEBPS/section0001.xhtml', data: Buffer.from(sectionXhtml('section0001', '<p>Not in spine</p>'), 'utf-8') },
  ]);
}

async function generateMultiNavEpub() {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf-8'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8') },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from(contentOpf({
        title: 'Multi-Nav Book',
        author: 'Author',
        language: 'en',
        identifier: 'urn:uuid:multi-nav',
        manifest: [
          { id: 'nav1', href: 'nav1.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'nav2', href: 'nav2.xhtml', mediaType: 'application/xhtml+xml' },
          { id: 'content', href: 'content.xhtml', mediaType: 'application/xhtml+xml' },
        ],
        spine: [
          { idref: 'nav1' },
          { idref: 'nav2' },
          { idref: 'content' },
        ],
      }), 'utf-8'),
    },
    { name: 'OEBPS/nav1.xhtml', data: Buffer.from(navXhtml([{ label: 'Chapter A', href: 'content.xhtml' }]), 'utf-8') },
    { name: 'OEBPS/nav2.xhtml', data: Buffer.from(navXhtml([{ label: 'Chapter B', href: 'content.xhtml' }]), 'utf-8') },
    { name: 'OEBPS/content.xhtml', data: Buffer.from(sectionXhtml('content', '<p>Multiple navs</p>'), 'utf-8') },
  ]);
}

async function generateInvalidMimetypeEpub() {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/octet-stream', 'utf-8'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8') },
    { name: 'OEBPS/content.opf', data: Buffer.from(contentOpf({
      title: 'Bad MIME',
      manifest: [
        { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'section0001', href: 'section0001.xhtml', mediaType: 'application/xhtml+xml' },
      ],
      spine: [
        { idref: 'nav', properties: 'nav' },
        { idref: 'section0001' },
      ],
    }), 'utf-8') },
    { name: 'OEBPS/nav.xhtml', data: Buffer.from(navXhtml([{ label: 'Start', href: 'section0001.xhtml' }]), 'utf-8') },
    { name: 'OEBPS/section0001.xhtml', data: Buffer.from(sectionXhtml('section0001', '<p>Bad MIME</p>'), 'utf-8') },
  ]);
}

async function generateMissingContainerEpub() {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf-8'), store: true },
    { name: 'OEBPS/content.opf', data: Buffer.from(contentOpf({
      title: 'No Container',
      manifest: [
        { id: 'section0001', href: 'section0001.xhtml', mediaType: 'application/xhtml+xml' },
      ],
      spine: [{ idref: 'section0001' }],
    }), 'utf-8') },
    { name: 'OEBPS/section0001.xhtml', data: Buffer.from(sectionXhtml('section0001', '<p>No container.xml</p>'), 'utf-8') },
  ]);
}

async function generateZipBombEpub() {
  const bombData = Buffer.alloc(10 * 1024 * 1024, 0); // 10MB of zeros
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip', 'utf-8'), store: true },
    { name: 'META-INF/container.xml', data: Buffer.from(containerXml('OEBPS/content.opf'), 'utf-8') },
    { name: 'OEBPS/content.opf', data: Buffer.from(contentOpf({
      title: 'Zip Bomb',
      manifest: [
        { id: 'bomb', href: 'bomb.xhtml', mediaType: 'application/xhtml+xml' },
      ],
      spine: [{ idref: 'bomb' }],
    }), 'utf-8') },
    { name: 'OEBPS/bomb.xhtml', data: bombData },
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
    ['zip-bomb.epub', generateZipBombEpub],
  ];

  for (const [filename, generator] of generators) {
    const buf = await generator();
    writeFileSync(resolve(__dirname, filename), buf);
    console.log(`Generated ${filename} (${buf.length} bytes)`);
  }
}

main().catch(console.error);

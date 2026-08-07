#!/usr/bin/env node
/**
 * Generates EPUB test corpus for benchmarking.
 * Uses raw ZIP construction via Node.js zlib — no external EPUB libraries.
 * Usage: node scripts/build-test-corpus.mjs [--output-dir <path>]
 */
import { deflateRawSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// --- CRC32 ---
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// --- ZIP builder (raw format, no streaming) ---
function buildZip(files) {
  const entries = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nb = new TextEncoder().encode(name);
    const comp = deflateRawSync(data, { level: 6 });
    const c = crc32(data);
    const local = Buffer.alloc(30 + nb.length);
    local.writeUInt32LE(0x04034B50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(c, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nb.length, 26);
    nb.forEach((b, i) => (local[30 + i] = b));
    entries.push({ nb, local, comp, c, csz: comp.length, usz: data.length, offset });
    offset += local.length + comp.length;
  }
  const cdOff = offset;
  let cdSz = 0;
  for (const e of entries) cdSz += 46 + e.nb.length;
  const cdParts = entries.map((e) => {
    const cd = Buffer.alloc(46 + e.nb.length);
    cd.writeUInt32LE(0x02014B50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(e.c, 16);
    cd.writeUInt32LE(e.csz, 20);
    cd.writeUInt32LE(e.usz, 24);
    cd.writeUInt16LE(e.nb.length, 28);
    cd.writeUInt16LE(0x20, 36);
    cd.writeUInt32LE(e.offset, 42);
    e.nb.forEach((b, i) => (cd[46 + i] = b));
    return cd;
  });
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054B50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSz, 12);
  eocd.writeUInt32LE(cdOff, 16);
  return Buffer.concat([...entries.flatMap((e) => [e.local, e.comp]), ...cdParts, eocd]);
}

// --- EPUB scaffolding ---
const XHTML = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n';
const CONTAINER = '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n  <rootfiles>\n    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n  </rootfiles>\n</container>';

function opf(chapters, extras = []) {
  const items = chapters.map((ch, i) => `    <item id="ch${i + 1}" href="${ch.href}" media-type="application/xhtml+xml"/>`).join('\n');
  const spine = chapters.map((ch, i) => `    <itemref idref="ch${i + 1}"/>`).join('\n');
  const ex = extras.map((e) => `    <item id="${e.id}" href="${e.href}" media-type="${e.type}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">\n  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n    <dc:identifier id="uid">urn:uuid:00000000-0000-0000-0000-000000000000</dc:identifier>\n    <dc:title>Test Corpus</dc:title>\n    <dc:language>en</dc:language>\n  </metadata>\n  <manifest>\n${items}\n${ex}\n    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>\n  </manifest>\n  <spine toc="ncx">\n${spine}\n  </spine>\n</package>`;
}

function ncx(chapters) {
  const np = chapters.map((ch, i) => `  <navPoint id="nav${i + 1}" playOrder="${i + 1}">\n    <navLabel><text>${ch.title}</text></navLabel>\n    <content src="${ch.href}"/>\n  </navPoint>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n  <head><meta name="dtb:uid" content="urn:uuid:00000000-0000-0000-0000-000000000000"/></head>\n  <docTitle><text>Test Corpus</text></docTitle>\n  <navMap>\n${np}\n  </navMap>\n</ncx>`;
}

function buildEpub(chapters, extras = []) {
  return buildZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip') },
    { name: 'META-INF/container.xml', data: Buffer.from(CONTAINER) },
    { name: 'OEBPS/content.opf', data: Buffer.from(opf(chapters, extras)) },
    { name: 'OEBPS/toc.ncx', data: Buffer.from(ncx(chapters)) },
    ...chapters.map((ch) => ({ name: `OEBPS/${ch.href}`, data: Buffer.from(ch.content) })),
    ...extras.map((e) => ({ name: `OEBPS/${e.href}`, data: e.data })),
  ]);
}

// --- Non-compressible buffer (xorshift PRNG) ---
function makeNoise(size) {
  const buf = Buffer.alloc(size);
  let s = 0x12345678;
  for (let i = 0; i < size; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; buf[i] = (s >>> 0) & 0xFF; }
  return buf;
}

const PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
const NOISE_BLOB = makeNoise(2 * 1024 * 1024);

// --- Corpus generators ---
function genSmallText() {
  const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ');
  const chapters = [];
  for (let i = 1; i <= 3; i++) {
    const paras = Array.from({ length: 2400 }, (_, j) => {
      const t = Array.from({ length: 50 }, (_, k) => words[(j * 50 + k) % words.length]).join(' ');
      return `  <p>Chapter ${i}, paragraph ${j + 1}. ${t.charAt(0).toUpperCase() + t.slice(1)}.</p>`;
    }).join('\n');
    chapters.push({ title: `Chapter ${i}`, href: `chapter${i}.xhtml`, content: `${XHTML}<body>\n<h1>Chapter ${i}</h1>\n${paras}\n</body>\n</html>` });
  }
  return buildEpub(chapters);
}

function genImageHeavy() {
  const chapters = [];
  for (let i = 1; i <= 5; i++) {
    const imgs = Array.from({ length: 20 }, (_, j) => `    <figure>\n      <img src="pixel.png" alt="Image ${j + 1} in chapter ${i}"/>\n      <figcaption>Figure ${j + 1}</figcaption>\n    </figure>`).join('\n\n');
    const paras = Array.from({ length: 5 }, (_, j) => `  <p>Chapter ${i}, paragraph ${j + 1}. This chapter contains images and text content for benchmarking image-heavy EPUB rendering.</p>`).join('\n');
    chapters.push({ title: `Chapter ${i}`, href: `chapter${i}.xhtml`, content: `${XHTML}<body>\n<h1>Chapter ${i}</h1>\n${paras}\n${imgs}\n</body>\n</html>` });
  }
  return buildEpub(chapters, [
    { id: 'pixel-img', href: 'pixel.png', type: 'image/png', data: PIXEL_PNG },
    { id: 'data-blob', href: 'data.bin', type: 'application/octet-stream', data: NOISE_BLOB },
  ]);
}

function genManyChapters() {
  const chapters = [];
  for (let i = 1; i <= 1300; i++) {
    chapters.push({ title: `Chapter ${i}`, href: `ch${String(i).padStart(3, '0')}.xhtml`, content: `${XHTML}<body>\n<h1>Chapter ${i}</h1>\n<p>This is the content of chapter ${i}. It contains a single short paragraph for testing many-chapter EPUB navigation and rendering performance with eight hundred chapters total.</p>\n</body>\n</html>` });
  }
  return buildEpub(chapters);
}

function genMalformed() {
  const block = [
    '<custom-widget type="banner">Non-standard custom element</custom-widget>\n',
    '<marquee>Scrolling text that should be sanitized</marquee>\n',
    '<div>Unclosed div element\n<p>This paragraph follows an unclosed div.</p>\n',
    '<p>Unicode test: \u0000 null char \u200B zero-width space \uFEFF BOM \u2028 line sep \u2029 para sep</p>\n',
    `<p data-huge="${'x'.repeat(4096)}">Text with large attribute</p>\n`,
    '<div><span><em>Nested unclosed tags</p>\n',
    '<p>Entities: &foo; &bar; &lt; &gt; &amp; &#x1F600;</p>\n',
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="red" onclick="alert(1)"/></svg>\n',
    '<script>alert("xss")</script>\n<style>body { display: none; }</style>\n',
    '<div onmouseover="evil()" onload="evil()">Event handlers</div>\n',
    '<a href="javascript:alert(1)">XSS link</a>\n',
    `<p>${Array.from({ length: 8192 }, (_, i) => String.fromCharCode(65 + ((i * 7 + 13) % 26))).join('')}</p>\n`,
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>Should be stripped</div></foreignObject></svg>\n',
    '<img src="data:text/html,<script>alert(1)</script>" alt="data uri"/>\n',
  ];
  let seed = 42;
  const body = Array.from({ length: 850 }, (_, i) => {
    seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
    return block.map((l) => l + `<!-- block ${i} seed ${seed} -->\n`).join('');
  }).join('');
  return buildEpub([{ title: 'Malformed Content', href: 'malformed.xhtml', content: `${XHTML}<body>\n<h1>Malformed Content</h1>\n${body}</body>\n</html>` }]);
}

function genAnnotationDense() {
  const chapters = [];
  for (let i = 1; i <= 3; i++) {
    const spans = Array.from({ length: 1800 }, (_, j) => {
      const t = `Chapter ${i}, paragraph ${j + 1}. This paragraph has an annotation marker for testing highlight anchoring and CFI range resolution performance under load.`;
      return `  <span id="para-${i}-${j}" class="annotated" data-cfi="/4/${j * 3 + 2}" data-range-start="${j * 100}" data-range-end="${j * 100 + t.length}" data-highlight-color="#ff0" data-highlight-id="hl-${i}-${j}">${t}</span>`;
    }).join('\n');
    chapters.push({ title: `Chapter ${i}`, href: `chapter${i}.xhtml`, content: `${XHTML}<body>\n<h1>Chapter ${i}</h1>\n${spans}\n</body>\n</html>` });
  }
  return buildEpub(chapters);
}

// --- Main ---
const args = process.argv.slice(2);
let outDir = join(import.meta.dirname, '..', 'packages', 'reader-core', 'src', '__fixtures__', 'corpus');
for (let i = 2; i < args.length; i++) { if (args[i] === '--output-dir' && args[i + 1]) outDir = args[++i]; }
mkdirSync(outDir, { recursive: true });

const corpus = [
  { name: 'small-text.epub', gen: genSmallText, target: '~50 KB' },
  { name: 'image-heavy.epub', gen: genImageHeavy, target: '~2 MB' },
  { name: 'many-chapters.epub', gen: genManyChapters, target: '~500 KB' },
  { name: 'malformed.epub', gen: genMalformed, target: '~100 KB' },
  { name: 'annotation-dense.epub', gen: genAnnotationDense, target: '~100 KB' },
];

for (const { name, gen, target } of corpus) {
  const data = gen();
  writeFileSync(join(outDir, name), data);
  console.log(`  ${name.padEnd(25)} ${(data.length / 1024).toFixed(1).padStart(8)} KB  (target: ${target})`);
}
console.log(`\nCorpus generated in ${outDir}`);

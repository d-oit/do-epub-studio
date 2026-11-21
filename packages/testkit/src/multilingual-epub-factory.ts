import { Buffer } from 'node:buffer';
import { deflateRawSync } from 'node:zlib';

/**
 * Deterministic, in-test EPUB builder for the reader typography/navigation
 * conformance matrix (issue #1491). No network, no binaries: every fixture is
 * assembled from static strings and packed with the same ZIP layout the real
 * toolchain produces (stored `mimetype` first, raw-deflate entries).
 */

export type MultilingualFixtureId =
  'ar-rtl' | 'he-rtl' | 'ja-vertical' | 'zh-ruby' | 'ko' | 'mixed-bidi' | 'inbook-lang-switch';

export const MULTILINGUAL_FIXTURES: readonly MultilingualFixtureId[] = [
  'ar-rtl',
  'he-rtl',
  'ja-vertical',
  'zh-ruby',
  'ko',
  'mixed-bidi',
  'inbook-lang-switch',
];

interface ChapterSpec {
  id: string;
  href: string;
  title: string;
  lang: string;
  dir?: 'ltr' | 'rtl';
  /** Extra CSS injected into the chapter head. */
  css?: string;
  bodyHtml: string;
}

interface BookSpec {
  id: MultilingualFixtureId;
  title: string;
  language: string;
  /** Package-level `dir`/`page-progression-direction` signal (epub.js honors both). */
  direction?: 'ltr' | 'rtl';
  /** If true, the nav TOC uses a two-level hierarchy. */
  tocNested?: boolean;
  /** Additional <nav> sections inside the nav document (landmarks/page-list). */
  extraNavSections?: string;
  chapters: ChapterSpec[];
}

const CHAPTER_CSS = `.bidi-run { unicode-bidi: isolate; }
.vertical { writing-mode: vertical-rl; text-orientation: mixed; }`;

const SPECS: Record<MultilingualFixtureId, BookSpec> = {
  'ar-rtl': {
    id: 'ar-rtl',
    title: 'كتاب عربي',
    language: 'ar',
    direction: 'rtl',
    tocNested: true,
    extraNavSections:
      '<nav epub:type="landmarks"><h2>Landmarks</h2><ol><li><a epub:type="bodymatter" href="chapter1.xhtml">بداية النص</a></li></ol></nav>' +
      '<nav epub:type="page-list"><h2>Pages</h2><ol><li><a href="chapter1.xhtml#p001">صفحة ١</a></li></ol></nav>',
    chapters: [
      {
        id: 'c1',
        href: 'chapter1.xhtml',
        title: 'المقدمة',
        lang: 'ar',
        dir: 'rtl',
        bodyHtml:
          '<p>هذه فقرة عربية تُقرأ من اليمين إلى اليسار مع <span lang="en" class="bidi-run">English run</span> داخل النص.</p>' +
          '<p>وجملة أخرى تنتهي بعلامة ترقيم عربية،</p>',
      },
      {
        id: 'c2',
        href: 'chapter2.xhtml',
        title: 'الفصل الأول',
        lang: 'ar',
        dir: 'rtl',
        bodyHtml: '<p>نص عربي خالص في الفصل الأول.</p>',
      },
    ],
  },
  'he-rtl': {
    id: 'he-rtl',
    title: 'ספר בעברית',
    language: 'he',
    direction: 'rtl',
    chapters: [
      {
        id: 'c1',
        href: 'chapter1.xhtml',
        title: 'פרק ראשון',
        lang: 'he',
        dir: 'rtl',
        bodyHtml: '<p>זהו משפט בעברית הנקרא מימין לשמאל, עם סימני פיסוק עבריים: ״ציטוט״.</p>',
      },
      {
        id: 'c2',
        href: 'chapter2.xhtml',
        title: 'פרק שני',
        lang: 'he',
        dir: 'rtl',
        bodyHtml: '<p>פרק שני קצר.</p>',
      },
    ],
  },
  'ja-vertical': {
    id: 'ja-vertical',
    title: '縦書きの本',
    language: 'ja',
    chapters: [
      {
        id: 'c1',
        href: 'chapter1.xhtml',
        title: '序章',
        lang: 'ja',
        css: CHAPTER_CSS,
        bodyHtml:
          '<p class="vertical">縦書きテキスト。句読点「」や括弧（）を含みます。</p>' +
          '<p class="vertical"><ruby>日本<rt>にほん</rt></ruby>という表記。</p>',
      },
      {
        id: 'c2',
        href: 'chapter2.xhtml',
        title: '第一章',
        lang: 'ja',
        css: CHAPTER_CSS,
        bodyHtml: '<p class="vertical">二つ目の章。日本語の文です。</p>',
      },
    ],
  },
  'zh-ruby': {
    id: 'zh-ruby',
    title: '中文图书',
    language: 'zh',
    tocNested: true,
    chapters: [
      {
        id: 'c1',
        href: 'chapter1.xhtml',
        title: '引言',
        lang: 'zh',
        css: CHAPTER_CSS,
        bodyHtml:
          '<p>这是包含拼音注释的文本：<ruby>汉字<rt>hànzì</rt></ruby>，以及中文标点：，。！？；：“”。</p>',
      },
      {
        id: 'c2',
        href: 'chapter2.xhtml',
        title: '第一章',
        lang: 'zh',
        bodyHtml: '<p>第一章内容，包含<ruby>中文<rt>zhōngwén</rt></ruby>。</p>',
      },
    ],
  },
  ko: {
    id: 'ko',
    title: '한국어 책',
    language: 'ko',
    chapters: [
      {
        id: 'c1',
        href: 'chapter1.xhtml',
        title: '첫 번째 장',
        lang: 'ko',
        bodyHtml: '<p>한국어 텍스트입니다. 문장 부호 “큰따옴표”와 「낫표」를 포함합니다.</p>',
      },
      {
        id: 'c2',
        href: 'chapter2.xhtml',
        title: '두 번째 장',
        lang: 'ko',
        bodyHtml: '<p>두 번째 장의 내용.</p>',
      },
    ],
  },
  'mixed-bidi': {
    id: 'mixed-bidi',
    title: 'Mixed Script Book',
    language: 'ar',
    chapters: [
      {
        id: 'c1',
        href: 'chapter1.xhtml',
        title: 'Chapter One',
        lang: 'ar',
        dir: 'rtl',
        css: CHAPTER_CSS,
        bodyHtml:
          '<p>بداية عربية ثم <span lang="en" class="bidi-run">Latin inside RTL</span> ثم عربية.</p>' +
          '<p>Syntax: <code class="bidi-run">a = b + c</code> remains LTR.</p>',
      },
      {
        id: 'c2',
        href: 'chapter2.xhtml',
        title: 'Chapter Two',
        lang: 'en',
        dir: 'ltr',
        bodyHtml:
          '<p>An English chapter with <span lang="ar" class="bidi-run">اقتباس عربي</span> inside.</p>',
      },
    ],
  },
  'inbook-lang-switch': {
    id: 'inbook-lang-switch',
    title: 'كتاب متعدد اللغات',
    language: 'ar',
    chapters: [
      {
        id: 'c1',
        href: 'chapter1.xhtml',
        title: 'المقدمة',
        lang: 'ar',
        dir: 'rtl',
        bodyHtml:
          '<p>مقدمة بالعربية وفيها <span lang="en" class="bidi-run">an English sentence</span> متداخلة.</p>',
      },
      {
        id: 'c2',
        href: 'chapter2.xhtml',
        title: 'English Chapter',
        lang: 'en',
        dir: 'ltr',
        bodyHtml:
          '<p>This chapter is in English and quotes <span lang="ar" class="bidi-run">اقتباس عربي</span>.</p>',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// ZIP packing (deterministic; mirrors the e2e fixture builder)
// ---------------------------------------------------------------------------

interface ZipFile {
  name: string;
  data: Buffer;
  method: number;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (const byte of buf) {
    const t = table[(crc ^ byte) & 0xff];
    crc = (t ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function packZip(files: ZipFile[]): Buffer {
  const localBlocks: Buffer[] = [];
  const centralBlocks: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameB = Buffer.from(file.name);
    const raw = file.data;
    const compressed = file.method === 0 ? raw : deflateRawSync(raw);
    const crc = crc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(file.method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compressed.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameB.length, 26);
    lh.writeUInt16LE(0, 28);
    localBlocks.push(Buffer.concat([lh, nameB]));
    localBlocks.push(compressed);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(file.method, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(compressed.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameB.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centralBlocks.push(Buffer.concat([ch, nameB]));

    offset += 30 + nameB.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralBlocks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localBlocks, centralDir, eocd]);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function chapterDocument(chapter: ChapterSpec): string {
  const attrs = [
    'xmlns="http://www.w3.org/1999/xhtml"',
    `lang="${escapeXml(chapter.lang)}"`,
    chapter.dir ? `dir="${chapter.dir}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const css = chapter.css ? `<style>${chapter.css}</style>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html ${attrs}>
<head><title>${escapeXml(chapter.title)}</title>${css}</head>
<body>${chapter.bodyHtml}</body>
</html>`;
}

function navDocument(spec: BookSpec): string {
  const flatToc = `<ol>${spec.chapters
    .map((c) => `<li><a href="${c.href}">${escapeXml(c.title)}</a></li>`)
    .join('\n')}</ol>`;
  const nestedToc = `<ol>
  <li><a href="${spec.chapters[0]?.href}">${escapeXml(spec.chapters[0]?.title ?? 'Part One')}</a></li>
  <li><span>Part Two</span>
    <ol>
      <li><a href="${spec.chapters[1]?.href}">${escapeXml(spec.chapters[1]?.title ?? 'Chapter')}</a></li>
    </ol>
  </li>
</ol>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body><nav epub:type="toc"><h1>Table of Contents</h1>${spec.tocNested ? nestedToc : flatToc}</nav>${spec.extraNavSections ?? ''}</body>
</html>`;
}

function opfDocument(spec: BookSpec): string {
  const spineAttr = spec.direction ? ` page-progression-direction="${spec.direction}"` : '';
  const manifest = spec.chapters
    .map((c) => `<item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`)
    .join('\n');
  const spine = spec.chapters.map((c) => `<itemref idref="${c.id}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:multilingual-${spec.id}</dc:identifier>
    <dc:title>${escapeXml(spec.title)}</dc:title>
    <dc:language>${escapeXml(spec.language)}</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifest}
  </manifest>
  <spine${spineAttr}>
    ${spine}
  </spine>
</package>`;
}

function buildFiles(spec: BookSpec): ZipFile[] {
  const files: ZipFile[] = [
    { name: 'mimetype', data: Buffer.from('application/epub+zip'), method: 0 },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from(
        '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
      ),
      method: 8,
    },
    { name: 'content.opf', data: Buffer.from(opfDocument(spec)), method: 8 },
    { name: 'nav.xhtml', data: Buffer.from(navDocument(spec)), method: 8 },
  ];
  for (const chapter of spec.chapters) {
    files.push({
      name: chapter.href,
      data: Buffer.from(chapterDocument(chapter)),
      method: 8,
    });
  }
  return files;
}

/** Build a deterministic multilingual fixture EPUB as a Node Buffer. */
export function buildMultilingualEpub(id: MultilingualFixtureId): Buffer {
  const spec = SPECS[id];
  if (!spec) throw new Error(`Unknown multilingual fixture: ${id}`);
  return packZip(buildFiles(spec));
}

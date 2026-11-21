/* eslint-disable @typescript-eslint/no-non-null-assertion -- test assertions */
import { describe, expect, it } from 'vitest';
import type { Buffer } from 'node:buffer';
import {
  buildMultilingualEpub,
  MULTILINGUAL_FIXTURES,
  type MultilingualFixtureId,
} from '@do-epub-studio/testkit';
import { createEpubLoader } from '../epub-loader';
import { createLocator, parseLocator, locatorToString } from '../locator';
import { flattenToc } from '../toc';
import { isValidCfi } from '../epub-loader';
import { sanitizeEpubDocument } from '../sanitizer';
import { readZipEntries } from './fixtures/epub-helpers';
import type { Book } from '@intity/epub-js';
import type { EpubLoader } from '../epub-loader';

/**
 * Reader typography / navigation conformance over curated multilingual fixtures
 * (issue #1491). These tests run the real reader-core pipeline (archive
 * validation + epub.js parsing + TOC/spine metadata) against deterministic,
 * in-test EPUBs. Render-only behavior (pagination, computed layout) lives in
 * apps/tests/reader-conformance.spec.ts (Playwright).
 */

interface FixtureExpectation {
  title: string;
  language: string;
  packagingDirection: 'ltr' | 'rtl' | '';
  tocLabels: string[];
  tocNested: boolean;
  spineHrefs: string[];
  /** Inner HTML markers that must survive the real sanitizer. */
  sanitizedMarkers: string[];
}

const EXPECTATIONS: Record<MultilingualFixtureId, FixtureExpectation> = {
  'ar-rtl': {
    title: 'كتاب عربي',
    language: 'ar',
    packagingDirection: 'rtl',
    tocLabels: ['المقدمة', 'الفصل الأول', 'الفصل الأول'],
    tocNested: true,
    spineHrefs: ['chapter1.xhtml', 'chapter2.xhtml'],
    sanitizedMarkers: ['dir="rtl"', 'lang="en"', 'class="bidi-run"', 'unicode-bidi: isolate', '،'],
  },
  'he-rtl': {
    title: 'ספר בעברית',
    language: 'he',
    packagingDirection: 'rtl',
    tocLabels: ['פרק ראשון', 'פרק שני'],
    tocNested: false,
    spineHrefs: ['chapter1.xhtml', 'chapter2.xhtml'],
    sanitizedMarkers: ['dir="rtl"', 'lang="he"', '״ציטוט״'],
  },
  'ja-vertical': {
    title: '縦書きの本',
    language: 'ja',
    packagingDirection: '',
    tocLabels: ['序章', '第一章'],
    tocNested: false,
    spineHrefs: ['chapter1.xhtml', 'chapter2.xhtml'],
    sanitizedMarkers: [
      'lang="ja"',
      'class="vertical"',
      'writing-mode: vertical-rl',
      'ruby',
      '<rt>',
      '句読点',
    ],
  },
  'zh-ruby': {
    title: '中文图书',
    language: 'zh',
    packagingDirection: '',
    tocLabels: ['引言', '第一章', '第一章'],
    tocNested: true,
    spineHrefs: ['chapter1.xhtml', 'chapter2.xhtml'],
    sanitizedMarkers: ['lang="zh"', 'ruby', '<rt>', '标点：，。！？；：“'],
  },
  ko: {
    title: '한국어 책',
    language: 'ko',
    packagingDirection: '',
    tocLabels: ['첫 번째 장', '두 번째 장'],
    tocNested: false,
    spineHrefs: ['chapter1.xhtml', 'chapter2.xhtml'],
    sanitizedMarkers: ['lang="ko"', '“큰따옴표”', '「낫표」'],
  },
  'mixed-bidi': {
    title: 'Mixed Script Book',
    language: 'ar',
    packagingDirection: '',
    tocLabels: ['Chapter One', 'Chapter Two'],
    tocNested: false,
    spineHrefs: ['chapter1.xhtml', 'chapter2.xhtml'],
    sanitizedMarkers: [
      'lang="en"',
      'lang="ar"',
      'class="bidi-run"',
      'unicode-bidi: isolate',
      'a = b + c',
    ],
  },
  'inbook-lang-switch': {
    title: 'كتاب متعدد اللغات',
    language: 'ar',
    packagingDirection: '',
    tocLabels: ['المقدمة', 'English Chapter'],
    tocNested: false,
    spineHrefs: ['chapter1.xhtml', 'chapter2.xhtml'],
    sanitizedMarkers: [
      'lang="ar"',
      'lang="en"',
      'class="bidi-run"',
      'اقتباس عربي',
      'an English sentence',
    ],
  },
};
/** Disable the web worker so the loader uses its documented main-thread
 * fallback (ADR-218 §6): Node's worker bridge re-uses the transferred buffer's
 * detached slab in this environment, which corrupts fixture parsing. The
 * fallback path still runs the real archive validation and epub.js parsing. */
async function withMainThreadFallback<T>(fn: () => Promise<T>): Promise<T> {
  const hasWorker = typeof globalThis.Worker !== 'undefined';
  const original = globalThis.Worker;
  if (hasWorker) {
    Object.defineProperty(globalThis, 'Worker', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  }
  try {
    return await fn();
  } finally {
    if (hasWorker) {
      Object.defineProperty(globalThis, 'Worker', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  }
}

function toUint8Array(buf: Buffer): Uint8Array {
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return new Uint8Array(ab);
}

async function loadFixture(id: MultilingualFixtureId): Promise<{
  loader: EpubLoader;
  book: Book;
}> {
  const buffer = buildMultilingualEpub(id);
  const loader = createEpubLoader();
  await withMainThreadFallback(() => loader.load(toUint8Array(buffer)));
  const book = loader.getBook();
  expect(book).not.toBeNull();
  return { loader, book: book! };
}

describe('multilingual conformance fixtures parse through the real loader', () => {
  it.each(MULTILINGUAL_FIXTURES)(
    '%s exposes expected metadata, spine and TOC hierarchy',
    async (id) => {
      const expected = EXPECTATIONS[id];
      const { loader, book } = await loadFixture(id);

      const metadata = loader.getMetadata();
      expect(metadata.title).toBe(expected.title);
      expect(metadata.language).toBe(expected.language);

      // Real epub.js packaging direction: spine page-progression-direction.
      expect(book.packaging?.direction).toBe(expected.packagingDirection);

      const spine = loader.getSpineItems();
      expect(spine.map((item) => item.href)).toEqual(expected.spineHrefs);

      const toc = loader.getToc();
      expect(toc.length).toBeGreaterThan(0);
      expect(flattenToc(toc).map((item) => item.label)).toEqual(expected.tocLabels);
      if (expected.tocNested) {
        expect(toc.some((item) => (item.subitems?.length ?? 0) > 0)).toBe(true);
        expect(flattenToc(toc).some((item) => item.href === expected.spineHrefs[1])).toBe(true);
      }
    },
  );

  it('exposes only TOC navigation from the nav document (no landmark/page-list APIs)', async () => {
    const { loader } = await loadFixture('ar-rtl');
    const toc = loader.getToc();
    // The nav document contains landmarks + page-list sections, but the reader
    // navigation model is TOC-only: no landmark/page-list entries surface.
    expect(toc.every((item) => item.href.includes('chapter'))).toBe(true);
    expect(toc.some((item) => item.href.includes('#p001'))).toBe(false);
  });

  it.each(MULTILINGUAL_FIXTURES)('%s CFI round-trips', (id) => {
    const cfi = 'epubcfi(/6/4)';
    expect(isValidCfi(cfi)).toBe(true);

    const titleText: Record<MultilingualFixtureId, string> = {
      'ar-rtl': 'نص عربي مع English',
      'he-rtl': 'טקסט בעברית',
      'ja-vertical': '縦書きのテキスト',
      'zh-ruby': '汉字与拼音',
      ko: '한국어 텍스트',
      'mixed-bidi': 'بداية عربية ثم Latin',
      'inbook-lang-switch': 'مقدمة بالعربية an English sentence',
    };
    const locator = createLocator(cfi, titleText[id], `${id}-chapter.xhtml`);
    const parsed = parseLocator(locatorToString(locator));
    expect(parsed).toEqual(locator);
    expect(parsed?.textExcerpt).toBe(titleText[id]);
  });

  it('keeps language, direction, bidi and ruby markup through the real sanitizer', () => {
    for (const id of MULTILINGUAL_FIXTURES) {
      const expected = EXPECTATIONS[id];
      const entries = readZipEntries(buildMultilingualEpub(id));
      const chapter = entries.get(expected.spineHrefs[0]!);
      expect(chapter, `${id} has first chapter`).toBeDefined();
      const doc = new DOMParser().parseFromString(
        chapter!.toString('utf8'),
        'application/xhtml+xml',
      );
      sanitizeEpubDocument(doc);

      // The chapter element keeps its declared language and direction.
      expect(doc.documentElement?.getAttribute('lang'), `${id} keeps html lang`).toBe(
        expected.language,
      );
      if (expected.packagingDirection === 'rtl') {
        expect(doc.documentElement?.getAttribute('dir'), `${id} keeps html dir`).toBe('rtl');
      }

      // Bidi isolation spans and ruby annotations survive sanitization.
      const bidiSpans = doc.querySelectorAll('span.bidi-run');
      for (const span of Array.from(bidiSpans)) {
        expect(span.getAttribute('lang'), `${id} keeps bidi span lang`).not.toBeNull();
        expect(span.getAttribute('class'), `${id} keeps bidi span class`).toContain('bidi-run');
      }
      if (expected.sanitizedMarkers.includes('<rt>')) {
        const rubyRt = doc.querySelector('ruby rt');
        expect(rubyRt, `${id} keeps ruby rt`).not.toBeNull();
      }

      // The original script text is present verbatim (never rewritten).
      const bodyText = doc.body?.textContent ?? '';
      const verbatimText: Record<MultilingualFixtureId, string> = {
        'ar-rtl': 'هذه فقرة عربية',
        'he-rtl': 'זהו משפט בעברית',
        'ja-vertical': '縦書きテキスト',
        'zh-ruby': '这是包含拼音注释',
        ko: '한국어 텍스트입니다',
        'mixed-bidi': 'بداية عربية ثم',
        'inbook-lang-switch': 'مقدمة بالعربية',
      };
      expect(bodyText, `${id} keeps script text`).toContain(verbatimText[id]);
    }
  });
});

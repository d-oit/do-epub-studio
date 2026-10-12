import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type * as ReaderCore from '@do-epub-studio/reader-core';
import { loadCreatorBook } from './book-chapters';

const loaderStub = vi.hoisted(() => ({
  load: vi.fn(),
  destroy: vi.fn(),
  getBook: vi.fn(),
  getMetadata: vi.fn(),
  getToc: vi.fn(),
}));

vi.mock('@do-epub-studio/reader-core', async (importOriginal) => {
  const actual = await importOriginal<typeof ReaderCore>();
  return { ...actual, createEpubLoader: () => loaderStub };
});

interface SectionStub {
  href: string;
  load: Mock;
  unload: Mock;
  contents: { textContent: string };
}

interface SpineStub {
  each: (callback: (section: SectionStub) => void) => void;
}

function section(href: string, text: string): SectionStub {
  return {
    href,
    load: vi.fn(() => Promise.resolve(undefined)),
    unload: vi.fn(),
    contents: { textContent: text },
  };
}

describe('loadCreatorBook (GOAP-293 grounding source)', () => {
  let sections: SectionStub[];

  beforeEach(() => {
    vi.clearAllMocks();
    sections = [
      section('c1.xhtml', 'Once upon a time.'),
      section('c2.xhtml', 'Second chapter.'),
      section('c4.xhtml', 'Nested chapter.'),
    ];
    // The ESM build's Spine is a Map-like iterable, not an `.each` collection.
    const collection = new Map(sections.map((item) => [item.href, item]));
    loaderStub.load.mockResolvedValue(undefined);
    loaderStub.getMetadata.mockReturnValue({ title: 'Book', language: 'en' });
    loaderStub.getToc.mockReturnValue([
      { id: 'n1', label: 'One', href: 'c1.xhtml' },
      { id: 'n2', label: 'Two', href: 'c2.xhtml#frag' },
      {
        id: 'n3',
        label: 'Nested',
        href: 'c3.xhtml',
        subitems: [{ id: 'n3a', label: 'Sub', href: 'c4.xhtml' }],
      },
    ]);
    loaderStub.getBook.mockReturnValue({
      sections: collection,
      load: vi.fn(() => Promise.resolve(undefined)),
    });
  });

  it('enumerates spine chapters keyed by href, with TOC titles (nested + fragment hrefs)', async () => {
    const book = await loadCreatorBook('signed-url');
    expect(loaderStub.load).toHaveBeenCalledWith('signed-url');
    expect(book.language).toBe('en');
    expect(book.chapters).toEqual([
      { ref: 'c1.xhtml', title: 'One', index: 0 },
      { ref: 'c2.xhtml', title: 'Two', index: 1 },
      { ref: 'c4.xhtml', title: 'Sub', index: 2 },
    ]);
    book.destroy();
    expect(loaderStub.destroy).toHaveBeenCalledTimes(1);
  });

  it('extracts only the selected chapters, hashes the reviewed text, and unloads each section', async () => {
    const book = await loadCreatorBook('signed-url');
    const { chapterText, chapterSha256 } = await book.extract(['c2.xhtml']);
    expect(chapterText).toEqual({ 'c2.xhtml': 'Second chapter.' });
    expect(chapterSha256['c2.xhtml']).toMatch(/^sha256:[0-9a-f]{64}$/);

    expect(sections[0]?.load).not.toHaveBeenCalled();
    expect(sections[0]?.unload).not.toHaveBeenCalled();
    expect(sections[1]?.load).toHaveBeenCalledTimes(1);
    expect(sections[1]?.unload).toHaveBeenCalledTimes(1);
  });

  it('produces identical hashes for identical text and hashes the full text', async () => {
    const book = await loadCreatorBook('signed-url');
    const first = await book.extract(['c1.xhtml']);
    const second = await book.extract(['c1.xhtml']);
    expect(first.chapterSha256['c1.xhtml']).toBe(second.chapterSha256['c1.xhtml']);
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('Once upon a time.'),
    );
    const expected = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    expect(first.chapterSha256['c1.xhtml']).toBe(`sha256:${expected}`);
  });

  it('fails loudly when the loader yields no usable spine', async () => {
    loaderStub.getBook.mockReturnValue(null);
    await expect(loadCreatorBook('signed-url')).rejects.toThrow('book spine is unavailable');
    expect(loaderStub.destroy).toHaveBeenCalledTimes(1);
  });

  it('falls back to book.spine (dist build) and still waits for book.ready', async () => {
    const late: {
      ready: Promise<void>;
      spine?: SpineStub;
      load?: (path: string) => Promise<unknown>;
    } = {
      ready: Promise.resolve(),
    };
    late.ready = new Promise<void>((resolve) => {
      queueMicrotask(() => {
        late.spine = {
          each: (callback) => {
            for (const item of sections) callback(item);
          },
        };
        late.load = vi.fn(() => Promise.resolve(undefined));
        resolve();
      });
    });
    loaderStub.getBook.mockReturnValue(late);
    const book = await loadCreatorBook('signed-url');
    expect(book.chapters.map((chapter) => chapter.ref)).toEqual([
      'c1.xhtml',
      'c2.xhtml',
      'c4.xhtml',
    ]);
  });

  it('prefers book.sections when a build exposes both collections', async () => {
    loaderStub.getBook.mockReturnValue({
      sections: new Map(sections.map((item) => [item.href, item])),
      spine: {
        each: (callback: (item: SectionStub) => void) => {
          callback(section('decoy.xhtml', 'Decoy.'));
        },
      },
      load: vi.fn(() => Promise.resolve(undefined)),
    });
    const book = await loadCreatorBook('signed-url');
    expect(book.chapters.map((chapter) => chapter.ref)).toEqual([
      'c1.xhtml',
      'c2.xhtml',
      'c4.xhtml',
    ]);
  });
});

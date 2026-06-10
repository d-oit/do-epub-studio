import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createEpubLoader, extractCfi, isValidCfi } from '../epub-loader';

const mockArrayBuffer = new ArrayBuffer(0);
vi.stubGlobal(
  'fetch',
  vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
  }),
);

vi.mock('../archive-validator', () => ({
  validateArchive: vi.fn().mockResolvedValue(undefined),
}));

// Mock epubjs module - vi.mock is hoisted so all definitions must be inside
vi.mock('@intity/epub-js', () => {
  const mockRendition = {
    on: vi.fn(),
    off: vi.fn(),
    display: vi.fn().mockResolvedValue(undefined),
    prev: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
    getContents: vi.fn().mockReturnValue(null),
    destroy: vi.fn(),
    hooks: {
      content: {
        register: vi.fn(),
      },
      render: {
        register: vi.fn(),
      },
    },
  };

  const mockBook = {
    opened: Promise.resolve(),
    loaded: {
      spine: Promise.resolve([
        { index: 0, href: 'chapter1.xhtml', properties: ['page-spread-right'] },
        { index: 1, href: 'chapter2.xhtml' },
      ]),
      navigation: Promise.resolve({
        toc: [
          { label: 'Chapter 1', href: 'chapter1.xhtml' },
          { label: 'Chapter 2', href: 'chapter2.xhtml' },
        ],
      }),
      metadata: Promise.resolve(
        new Map([
          ['title', 'Test Book'],
          ['creator', 'Test Author'],
          ['language', 'en'],
          ['publisher', 'Test Publisher'],
          ['description', 'A test book'],
        ]),
      ),
    },
    packaging: { direction: 'default', metadata: new Map() },
    renderTo: vi.fn().mockReturnValue(mockRendition),
    destroy: vi.fn(),
  };

  const ePub = vi.fn().mockReturnValue(mockBook);

  return { default: ePub, __mockRendition: mockRendition, __mockBook: mockBook };
});

// Get mock references after hoisting
interface MockBook {
  renderTo: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  packaging: { direction: string; metadata: Map<string, string> };
}

const epubjsMock = vi.mocked((await import('@intity/epub-js')) as unknown) as {
  __mockRendition: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    display: ReturnType<typeof vi.fn>;
    prev: ReturnType<typeof vi.fn>;
    next: ReturnType<typeof vi.fn>;
    getContents: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  __mockBook: MockBook;
};

describe('extractCfi', () => {
  it('extracts cfi from text containing epubcfi', () => {
    const result = extractCfi('Start epubcfi(/6/4[chap1]) end');
    expect(result).toBe('epubcfi(/6/4[chap1])');
  });

  it('returns null for text without cfi', () => {
    const result = extractCfi('no cfi here');
    expect(result).toBeNull();
  });

  it('extracts first cfi when multiple present', () => {
    const result = extractCfi('epubcfi(/6/4) and epubcfi(/6/10)');
    expect(result).toBe('epubcfi(/6/4)');
  });
});

describe('isValidCfi', () => {
  it('returns true for valid cfi', () => {
    expect(isValidCfi('epubcfi(/6/4)')).toBe(true);
  });

  it('returns true for cfi with idref', () => {
    expect(isValidCfi('epubcfi(/6/4[chap1ref])')).toBe(true);
  });

  it('returns true for complex cfi', () => {
    expect(isValidCfi('epubcfi(/6/12!/4/2[p001]/2/1:0)')).toBe(true);
  });

  it('returns false for plain string', () => {
    expect(isValidCfi('not-a-cfi')).toBe(false);
  });

  it('returns false for cfi without epubcfi prefix', () => {
    expect(isValidCfi('(/6/4)')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidCfi('')).toBe(false);
  });
});

describe('createEpubLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    epubjsMock.__mockBook.packaging = { direction: 'default', metadata: new Map() };
  });

  it('creates a loader with null rendition initially', () => {
    const loader = createEpubLoader();
    expect(loader.rendition).toBeNull();
  });

  it('returns initial empty metadata before load', () => {
    const loader = createEpubLoader();
    expect(loader.getMetadata()).toEqual({ title: '' });
    expect(loader.getToc()).toEqual([]);
    expect(loader.getSpineItems()).toEqual([]);
    expect(loader.getProgress()).toBeNull();
  });

  it('throws on createRendition before load', () => {
    const loader = createEpubLoader();
    expect(() => loader.createRendition(document.createElement('div'))).toThrow(
      'Book not loaded. Call load() first.',
    );
  });

  it('parses toc, spine, and metadata on load', async () => {
    const loader = createEpubLoader();
    await loader.load('test.epub');

    const toc = loader.getToc();
    expect(toc).toHaveLength(2);
    expect(toc[0]?.label).toBe('Chapter 1');
    expect(toc[0]?.href).toBe('chapter1.xhtml');

    const spine = loader.getSpineItems();
    expect(spine).toHaveLength(2);
    expect(spine[0]?.href).toBe('chapter1.xhtml');
    expect(spine[1]?.index).toBe(1);

    const metadata = loader.getMetadata();
    expect(metadata.title).toBe('Test Book');
    expect(metadata.creator).toBe('Test Author');
    expect(metadata.language).toBe('en');
  });

  it('detects default direction from packaging', async () => {
    const loader = createEpubLoader();
    await loader.load('test.epub');

    const metadata = loader.getMetadata();
    expect(metadata.direction).toBe('default');
  });

  it('detects rtl direction from packaging', async () => {
    epubjsMock.__mockBook.packaging = { direction: 'rtl', metadata: new Map() };
    const loader = createEpubLoader();
    await loader.load('test.epub');

    const metadata = loader.getMetadata();
    expect(metadata.direction).toBe('rtl');
  });

  it('detects ltr direction from packaging', async () => {
    epubjsMock.__mockBook.packaging = { direction: 'ltr', metadata: new Map() };
    const loader = createEpubLoader();
    await loader.load('test.epub');

    const metadata = loader.getMetadata();
    expect(metadata.direction).toBe('ltr');
  });

  it('detects pre-paginated fixed layout from packaging metadata', async () => {
    epubjsMock.__mockBook.packaging = {
      direction: 'default',
      metadata: new Map([['layout', 'pre-paginated']]),
    };
    const loader = createEpubLoader();
    await loader.load('test.epub');

    const metadata = loader.getMetadata();
    expect(metadata.fixedLayout).toBeDefined();
    expect(metadata.fixedLayout?.layout).toBe('pre-paginated');
  });

  it('detects reflowable layout from packaging metadata', async () => {
    epubjsMock.__mockBook.packaging = {
      direction: 'default',
      metadata: new Map([['layout', 'reflowable']]),
    };
    const loader = createEpubLoader();
    await loader.load('test.epub');

    const metadata = loader.getMetadata();
    expect(metadata.fixedLayout).toBeDefined();
    expect(metadata.fixedLayout?.layout).toBe('reflowable');
  });

  it('sets undefined fixedLayout when no layout in metadata', async () => {
    const loader = createEpubLoader();
    await loader.load('test.epub');

    const metadata = loader.getMetadata();
    expect(metadata.fixedLayout).toBeUndefined();
  });

  it('parses orientation and spread from packaging metadata', async () => {
    epubjsMock.__mockBook.packaging = {
      direction: 'default',
      metadata: new Map([
        ['layout', 'pre-paginated'],
        ['orientation', 'landscape'],
        ['spread', 'none'],
      ]),
    };
    const loader = createEpubLoader();
    await loader.load('test.epub');

    const metadata = loader.getMetadata();
    expect(metadata.fixedLayout?.orientation).toBe('landscape');
    expect(metadata.fixedLayout?.spread).toBe('none');
  });

  it('parses viewport from packaging metadata', async () => {
    epubjsMock.__mockBook.packaging = {
      direction: 'default',
      metadata: new Map([
        ['layout', 'pre-paginated'],
        ['viewport', 'width=1024,height=768'],
      ]),
    };
    const loader = createEpubLoader();
    await loader.load('test.epub');

    const metadata = loader.getMetadata();
    expect(metadata.fixedLayout?.viewport).toBe('width=1024,height=768');
  });

  it('throws on load after destroy', async () => {
    const loader = createEpubLoader();
    loader.destroy();

    await expect(loader.load('test.epub')).rejects.toThrow('EpubLoader has been destroyed');
  });

  it('emits events via onEvent callback', async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const loader = createEpubLoader({
      onEvent: (event, data) => {
        events.push({ event, data });
      },
    });
    await loader.load('test.epub');
    loader.createRendition(document.createElement('div'));

    // Simulate relocated event from the mocked rendition
    const mockRendition = epubjsMock.__mockRendition;
    const relocatedCall = mockRendition.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'relocated',
    ) as [string, (data: unknown) => void] | undefined;
    if (relocatedCall) {
      const callback = relocatedCall[1];
      callback({
        start: {
          cfi: 'epubcfi(/6/4)',
          percentage: 0.25,
          displayed: { page: 1 },
          href: 'chapter1.xhtml',
        },
      });
    }

    expect(events.some((e) => e.event === 'relocated')).toBe(true);
  });

  it('returns defensive copies of arrays', async () => {
    const loader = createEpubLoader();
    await loader.load('test.epub');

    const toc1 = loader.getToc();
    const toc2 = loader.getToc();
    expect(toc1).not.toBe(toc2);

    const spine1 = loader.getSpineItems();
    const spine2 = loader.getSpineItems();
    expect(spine1).not.toBe(spine2);
  });

  it('throws on setProgress without rendition', async () => {
    const loader = createEpubLoader();
    await loader.load('test.epub');

    await expect(loader.setProgress('epubcfi(/6/4)')).rejects.toThrow(
      'Rendition not created. Call createRendition() first.',
    );
  });

  it('reuses existing rendition handle', async () => {
    const loader = createEpubLoader();
    await loader.load('test.epub');

    const container1 = document.createElement('div');
    const container2 = document.createElement('div');

    const handle1 = loader.createRendition(container1);
    const handle2 = loader.createRendition(container2);

    expect(handle1).toBe(handle2);
    expect(epubjsMock.__mockBook.renderTo).toHaveBeenCalledTimes(1);
  });

  it('registers and removes event listeners', () => {
    const loader = createEpubLoader();
    const handler = vi.fn();

    loader.on('custom', handler);
    loader.off('custom', handler);
  });
});

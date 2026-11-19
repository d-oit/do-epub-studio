import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAuthStore, useReaderStore } from '../../../stores';
import {
  buildNotesExport,
  useExportNotes,
  notesExportToMarkdown,
  importNotesFromMarkdown,
  parseExportFilename,
} from './useExportNotes';
import { NOTES_FORMAT_VERSION, NOTES_MIME_TYPE, type NotesExport } from '../lib/notes-types';

describe('useExportNotes — constants', () => {
  it('NOTES_FORMAT_VERSION is 1', () => {
    expect(NOTES_FORMAT_VERSION).toBe(1);
  });

  it('NOTES_MIME_TYPE is text/markdown', () => {
    expect(NOTES_MIME_TYPE).toBe('text/markdown');
  });
});

describe('useExportNotes — buildNotesExport', () => {
  it('creates export with correct format and version', () => {
    const result = buildNotesExport({
      bookTitle: 'Test Book',
      bookId: 'book-1',
      highlights: [],
      comments: [],
      bookmarks: [],
    });

    expect(result.format).toBe('do-epub-studio-notes');
    expect(result.version).toBe(1);
    expect(result.bookTitle).toBe('Test Book');
    expect(result.bookId).toBe('book-1');
    expect(result.annotations).toEqual([]);
  });

  it('includes highlights, comments, and bookmarks', () => {
    const result = buildNotesExport({
      bookTitle: 'Book',
      bookId: null,
      highlights: [
        {
          id: 'h1',
          selectedText: 'text',
          color: '#ff0000',
          note: null,
          chapterRef: null,
          cfiRange: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      comments: [
        {
          id: 'c1',
          displayName: 'u',
          isOwn: false,
          body: 'body',
          status: 'open',
          visibility: 'shared',
          parentCommentId: null,
          selectedText: null,
          chapterRef: null,
          cfiRange: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          resolvedAt: null,
        },
      ],
      bookmarks: [
        {
          id: 'b1',
          locator: { cfi: 'cfi', selectedText: 'text' },
          label: 'mark',
          createdAt: '2026-01-01',
        },
      ],
    });

    expect(result.annotations).toHaveLength(3);
    expect(result.annotations[0]?.type).toBe('highlight');
    expect(result.annotations[1]?.type).toBe('comment');
    expect(result.annotations[2]?.type).toBe('bookmark');
  });

  it('filters out deleted comments', () => {
    const result = buildNotesExport({
      bookTitle: 'Book',
      bookId: null,
      highlights: [],
      comments: [
        {
          id: 'c1',
          displayName: 'u',
          isOwn: false,
          body: 'open',
          status: 'open',
          visibility: 'shared',
          parentCommentId: null,
          selectedText: null,
          chapterRef: null,
          cfiRange: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          resolvedAt: null,
        },
        {
          id: 'c2',
          displayName: 'u',
          isOwn: false,
          body: 'deleted',
          status: 'deleted',
          visibility: 'shared',
          parentCommentId: null,
          selectedText: null,
          chapterRef: null,
          cfiRange: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          resolvedAt: null,
        },
      ],
      bookmarks: [],
    });

    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]?.type).toBe('comment');
  });
});

describe('useExportNotes — notesExportToMarkdown', () => {
  it('generates markdown with header and sections', () => {
    const exportData: NotesExport = {
      format: 'do-epub-studio-notes',
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      bookTitle: 'My Book',
      bookId: 'book-1',
      annotations: [
        {
          type: 'highlight',
          id: 'h1',
          selectedText: 'hello',
          color: '#ff0000',
          note: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          locator: null,
        },
      ],
    };

    const md = notesExportToMarkdown(exportData);

    expect(md).toContain('# My Book - Exported Notes');
    expect(md).toContain('## Highlights');
    expect(md).toContain('"hello"');
  });

  it('generates empty message when no annotations', () => {
    const exportData: NotesExport = {
      format: 'do-epub-studio-notes',
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      bookTitle: 'Book',
      bookId: null,
      annotations: [],
    };

    const md = notesExportToMarkdown(exportData);

    expect(md).toContain('_No annotations to export._');
  });
});

describe('useExportNotes — importNotesFromMarkdown', () => {
  it('returns error for unrecognized format', () => {
    const result = importNotesFromMarkdown('# Just a plain markdown');

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('Unrecognized notes format');
  });

  it('imports highlights from markdown', () => {
    const md = `# Test Book - Exported Notes

<!-- format: do-epub-studio-notes v1 -->
<!-- exportedAt: 2026-01-01T00:00:00Z -->

## Highlights

- "important text" (#ff0000)
`;
    const result = importNotesFromMarkdown(md);

    expect(result.ok).toBe(true);
    expect(result.highlights).toHaveLength(1);
    expect(result.highlights[0]?.selectedText).toMatch(/^important text/);
  });

  it('imports bookmarks from markdown', () => {
    const md = `# Test Book - Exported Notes

<!-- format: do-epub-studio-notes v1 -->

## Bookmarks

- "bookmark text" — my label
`;
    const result = importNotesFromMarkdown(md);

    expect(result.ok).toBe(true);
    expect(result.bookmarks).toHaveLength(1);
    expect(result.bookmarks[0]?.label).toBe('my label');
  });

  it('imports comments from markdown', () => {
    const md = `# Test Book - Exported Notes

<!-- format: do-epub-studio-notes v1 -->

## Comments

- This is my comment — "quoted text"
`;
    const result = importNotesFromMarkdown(md);

    expect(result.ok).toBe(true);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]?.body).toBe('This is my comment');
  });
});

describe('useExportNotes — parseExportFilename', () => {
  it('returns sanitized filename', () => {
    expect(parseExportFilename('My Book')).toBe('My Book-notes.md');
    expect(parseExportFilename('My Book', 'html')).toBe('My Book-notes.html');
    expect(parseExportFilename('My Book', 'epub')).toBe('My Book-annotated.epub');
  });

  it('replaces unsafe characters', () => {
    expect(parseExportFilename('Book/With:Special*Chars')).toBe('Book_With_Special_Chars-notes.md');
  });

  it('uses fallback for null title', () => {
    expect(parseExportFilename(null)).toBe('notes-notes.md');
  });

  it('uses fallback for undefined title', () => {
    expect(parseExportFilename(undefined)).toBe('notes-notes.md');
  });
});
describe('useExportNotes — file downloads', () => {
  const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  let fetchMock: ReturnType<typeof vi.fn>;
  let downloadBlobs: Blob[];
  let downloadLinks: HTMLAnchorElement[];

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    downloadBlobs = [];
    downloadLinks = [];
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: (blob: Blob) => {
        downloadBlobs.push(blob);
        return 'blob:notes-export';
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadLinks.push(this);
    });
    act(() => {
      useAuthStore.setState({ bookId: 'book/one', sessionToken: 'reader-token' });
      useReaderStore.setState({ highlights: [], comments: [], bookmarks: [] });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (createObjectUrlDescriptor) {
      Object.defineProperty(URL, 'createObjectURL', createObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, 'createObjectURL');
    }
    if (revokeObjectUrlDescriptor) {
      Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
    act(() => {
      useAuthStore.setState({ bookId: null, sessionToken: null });
      useReaderStore.setState({ highlights: [], comments: [], bookmarks: [] });
    });
  });

  it('keeps Markdown export local and downloads the notes file', async () => {
    const { result } = renderHook(() => useExportNotes());

    await act(async () => {
      await result.current.handleExportNotes('My Book');
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(downloadLinks[0]?.download).toBe('My Book-notes.md');
    expect(downloadBlobs[0]?.type).toBe(NOTES_MIME_TYPE);
    await expect(downloadBlobs[0]?.text()).resolves.toContain('# My Book - Exported Notes');
  });

  it('downloads server-rendered HTML with the authenticated book export route', async () => {
    const html = '<!doctype html><title>Book notes</title>';
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: true, data: { format: 'html', title: 'Book', content: html } }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const { result } = renderHook(() => useExportNotes());

    await act(async () => {
      await result.current.handleExportNotes('My Book', 'html');
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toContain('/api/books/book%2Fone/export?format=html');
    expect(new Headers(requestInit.headers).get('Authorization')).toBe('Bearer reader-token');
    expect(downloadLinks[0]?.download).toBe('My Book-notes.html');
    expect(downloadBlobs[0]?.type).toBe('text/html;charset=utf-8');
    await expect(downloadBlobs[0]?.text()).resolves.toBe(html);
  });

  it('downloads the annotated EPUB response as binary bytes', async () => {
    const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);
    fetchMock.mockResolvedValueOnce(
      new Response(bytes, {
        status: 200,
        headers: { 'Content-Type': 'application/epub+zip' },
      }),
    );
    const { result } = renderHook(() => useExportNotes());

    await act(async () => {
      await result.current.handleExportNotes('My Book', 'epub');
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toContain('/api/books/book%2Fone/export?format=epub');
    expect(new Headers(requestInit.headers).get('Authorization')).toBe('Bearer reader-token');
    expect(downloadLinks[0]?.download).toBe('My Book-annotated.epub');
    expect(downloadBlobs[0]?.type).toBe('application/epub+zip');
    expect([...new Uint8Array(await (downloadBlobs[0] as Blob).arrayBuffer())]).toEqual([...bytes]);
  });

  it('does not create a download when the export request fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const { result } = renderHook(() => useExportNotes());

    await expect(result.current.handleExportNotes('My Book', 'html')).rejects.toThrow('Forbidden');
    expect(downloadLinks).toHaveLength(0);
    expect(downloadBlobs).toHaveLength(0);
  });

  // The Worker validates the generated archive against the EPUBCheck runner
  // synchronously (130 s budget) before returning bytes. The client default of
  // 15 s aborted valid slow exports, so the EPUB branch declares its own
  // deadline; a response arriving after the default must still download.
  it('accepts an EPUB response that arrives after the default request deadline', async () => {
    vi.useFakeTimers();
    try {
      const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);
      fetchMock.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            const timer = setTimeout(
              () =>
                resolve(
                  new Response(bytes, {
                    status: 200,
                    headers: { 'Content-Type': 'application/epub+zip' },
                  }),
                ),
              20_000,
            );
            // Real fetch rejects on abort; without this the client deadline
            // would be invisible to the test.
            init.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              const reason: unknown = init.signal?.reason;
              reject(reason instanceof Error ? reason : new Error(String(reason)));
            });
          }),
      );
      const { result } = renderHook(() => useExportNotes());

      let exportPromise: Promise<void> | undefined;
      act(() => {
        exportPromise = result.current.handleExportNotes('My Book', 'epub');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      await expect(exportPromise).resolves.toBeUndefined();
      expect(downloadLinks[0]?.download).toBe('My Book-annotated.epub');
      expect(downloadBlobs[0]?.type).toBe('application/epub+zip');
    } finally {
      vi.useRealTimers();
    }
  });

  it('still aborts an HTML export that outruns the default request deadline', async () => {
    vi.useFakeTimers();
    try {
      // Honour the request's abort signal, like real fetch: a promise that
      // ignores it never settles, so the client's deadline would not surface.
      fetchMock.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              const reason: unknown = init.signal?.reason;
              reject(reason instanceof Error ? reason : new Error(String(reason)));
            });
          }),
      );
      const { result } = renderHook(() => useExportNotes());

      let exportPromise: Promise<void> | undefined;
      act(() => {
        exportPromise = result.current.handleExportNotes('My Book', 'html');
      });
      exportPromise?.catch(() => undefined);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_001);
      });

      await expect(exportPromise).rejects.toThrow(/timeout/i);
      expect(downloadLinks).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

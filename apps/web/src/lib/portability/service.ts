import JSZip from 'jszip';
import { apiRequest } from '../api/core';
import type { LibraryBookResponse } from '@do-epub-studio/shared';
import type { Bookmark, Comment, Highlight, ReadingProgress } from '../../stores/reader';
import type { PortabilityProgress, PortabilityScope } from '@do-epub-studio/schema';
import {
  buildPortabilityEnvelope,
  stringifyPortabilityEnvelope,
  type PublicationExportSource,
} from './build';

export const LIBRARY_PAGE_SIZE = 50;

export interface BookStateData {
  highlights: Highlight[];
  comments: Comment[];
  bookmarks: Bookmark[];
  progress: ReadingProgress;
}

/** Fetch the full library (paged) with cancellation. */
export async function fetchLibraryBooks(
  token: string,
  signal?: AbortSignal,
): Promise<LibraryBookResponse[]> {
  const books: LibraryBookResponse[] = [];
  let offset = 0;
  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const page = await apiRequest<{
      items: LibraryBookResponse[];
      hasMore: boolean;
    }>(`/api/books?limit=${LIBRARY_PAGE_SIZE}&offset=${offset}`, {
      method: 'GET',
      token,
      signal,
    });
    books.push(...page.items);
    if (!page.hasMore || page.items.length === 0) break;
    offset += page.items.length;
  }
  return books;
}

/** Fetch one book's reader state (annotations + progress), paged, cancelable. */
export async function fetchBookState(
  bookId: string,
  token: string,
  signal?: AbortSignal,
): Promise<BookStateData> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const [highlights, comments, bookmarks, progress] = await Promise.all([
    apiRequest<Highlight[]>(`/api/books/${bookId}/highlights?limit=1000&offset=0`, {
      method: 'GET',
      token,
      signal,
    }),
    apiRequest<Comment[]>(`/api/books/${bookId}/comments?limit=1000&offset=0`, {
      method: 'GET',
      token,
      signal,
    }),
    apiRequest<Bookmark[]>(`/api/books/${bookId}/bookmarks?limit=1000&offset=0`, {
      method: 'GET',
      token,
      signal,
    }),
    apiRequest<{ locator: { cfi?: string; chapterRef?: string; selectedText?: string } | null; progressPercent: number; updatedAt?: string; revision?: number }>(
      `/api/books/${bookId}/progress`,
      { method: 'GET', token, signal },
    ),
  ]);

  return {
    highlights,
    comments,
    bookmarks,
    progress: {
      locator: progress.locator ?? null,
      progressPercent: progress.progressPercent ?? 0,
      updatedAt: progress.updatedAt ?? null,
      revision: progress.revision ?? 0,
    },
  };
}

function toPortabilityProgress(p: ReadingProgress): PortabilityProgress | null {
  return {
    locator: p.locator ? { cfi: p.locator.cfi ?? '', chapterRef: p.locator.chapterRef, selectedText: p.locator.selectedText } : null,
    progressPercent: p.progressPercent,
    updatedAt: p.updatedAt,
  };
}

export interface AccountExportSource {
  books: LibraryBookResponse[];
  states: Record<string, BookStateData>;
}

/** Assemble a full-account export source from the library + per-book state. */
export function accountExportSource(data: AccountExportSource): PublicationExportSource[] {
  return data.books.map((book) => {
    const state = data.states[book.id] ?? { highlights: [], comments: [], bookmarks: [], progress: { locator: null, progressPercent: 0, updatedAt: null, revision: 0 } };
    return {
      bookId: book.id,
      slug: book.slug,
      title: book.title,
      highlights: state.highlights,
      bookmarks: state.bookmarks,
      comments: state.comments,
      progress: toPortabilityProgress(state.progress),
    };
  });
}

export interface ExportOptions {
  token: string;
  scope: PortabilityScope;
  /** for book scope: the single book; for account scope: all library books */
  books: LibraryBookResponse[];
  states: Record<string, BookStateData>;
  includeBookFiles?: boolean;
  signal?: AbortSignal;
  /** optional per-book progress override (e.g. from store) */
  progressOverride?: Record<string, ReadingProgress>;
}

export async function exportPortabilityArchive(options: ExportOptions): Promise<{
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}> {
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const sources = accountExportSource({ books: options.books, states: options.states });
  const envelope = buildPortabilityEnvelope({
    scope: options.scope,
    publications: sources,
    preferences: options.scope === 'account' ? undefined : undefined,
  });
  const json = stringifyPortabilityEnvelope(envelope);

  if (options.includeBookFiles) {
    const zip = new JSZip();
    zip.file('portability.json', json);
    for (const book of options.books) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const url = await getBookFileUrl(book.id, options.token, options.signal);
      if (!url) continue;
      const fileBytes = await fetchBytes(url, options.signal);
      zip.file(`${book.slug}.epub`, fileBytes);
    }
    const blob = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return { filename: `do-epub-studio-export-${envelope.exportedAt.slice(0, 10)}.zip`, mimeType: 'application/zip', bytes: blob };
  }

  const bytes = new TextEncoder().encode(json);
  return { filename: `do-epub-studio-export-${envelope.exportedAt.slice(0, 10)}.json`, mimeType: 'application/json', bytes };
}

async function getBookFileUrl(bookId: string, token: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const data = await apiRequest<{ url: string }>(`/api/books/${bookId}/file-url`, {
      method: 'POST',
      token,
      body: JSON.stringify({}),
      signal,
    });
    return data.url;
  } catch {
    return null;
  }
}

async function fetchBytes(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to fetch book file: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

/** Parse an imported file: either a raw JSON envelope or a ZIP bundle. */
export async function parsePortabilityFile(file: File | { name: string; bytes: Uint8Array }): Promise<{
  json: string;
  bookFiles: Map<string, Uint8Array>;
}> {
  let bytes: Uint8Array;

  if (file instanceof File) {
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    bytes = file.bytes;
  }

  const name = file.name ?? '';
  if (name.endsWith('.zip') || bytes.slice(0, 2)[0] === 0x50 && bytes[1] === 0x4b) {
    const zip = await JSZip.loadAsync(bytes);
    const manifest = zip.file('portability.json');
    if (!manifest) throw new Error('ZIP archive is missing portability.json');
    const json = await manifest.async('string');
    const bookFiles = new Map<string, Uint8Array>();
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || entry.name === 'portability.json') continue;
      const data = await entry.async('uint8array');
      bookFiles.set(entry.name, data);
    }
    return { json, bookFiles };
  }

  return { json: new TextDecoder().decode(bytes), bookFiles: new Map() };
}

export { toPortabilityProgress };

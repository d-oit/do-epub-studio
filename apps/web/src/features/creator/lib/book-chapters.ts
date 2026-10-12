// book-chapters.ts — grounded chapter source for creator editorial review.
//
// F1 (GOAP-290) / GOAP-293: assistance needs the manuscript text on the
// creator's device. It comes from the creator's own read access — the signed
// book file URL is fetched with the session token and rejected by the Worker
// unless the account holds a non-revoked read grant (ADR-999 D1). No new
// endpoint is involved and no text leaves the tab.
//
// Text extraction mirrors the proven non-rendering reader pattern
// (features/reader/hooks/useReaderSearch.ts): spine section load → textContent
// → unload, keyed by the section `href` — the same chapterRef anchors and the
// editorial engines use.

import { createEpubLoader, type TocItem } from '@do-epub-studio/reader-core';
import { apiRequest } from '../../../lib/api';
import { collectSpineSections } from '../../../lib/epub-sections';

export interface BookChapter {
  /** Spine section href — the chapterRef used by anchors and engines. */
  ref: string;
  title: string;
  index: number;
}

interface SpineSectionLike {
  href: string;
  /** Spine position when the build exposes it; iteration order is authoritative otherwise. */
  index?: number;
  load(loader: unknown): Promise<unknown>;
  unload(): void;
  contents?: { textContent?: string | null } | null;
}

interface BookLike {
  /**
   * epub.js resolves `ready` before some builds expose their section
   * collection (the reader awaits it too).
   */
  ready?: Promise<unknown>;
  load?: (path: string) => Promise<unknown>;
}

export interface ExtractedChapters {
  chapterText: Record<string, string>;
  chapterSha256: Record<string, string>;
}

export interface CreatorBook {
  chapters: BookChapter[];
  /** BCP-47 language from EPUB metadata, when present. */
  language: string | null;
  /** Extract the selected chapters (all when omitted). */
  extract(refs?: readonly string[]): Promise<ExtractedChapters>;
  destroy(): void;
}

/** Signed file URL for a book the session can read (POST /:id/file-url). */
export async function fetchBookFileUrl(
  bookId: string,
  token: string,
): Promise<{ url: string; fileId: string | null }> {
  const data = await apiRequest<{ url: string; fileId?: string }>(`/api/books/${bookId}/file-url`, {
    method: 'POST',
    token,
    body: '{}',
  });
  return { url: data.url, fileId: data.fileId ?? null };
}

function findChapterTitle(toc: readonly TocItem[], href: string): string | undefined {
  const cleanHref = href.split('#')[0];
  for (const item of toc) {
    if (item.href && (item.href === href || item.href.split('#')[0] === cleanHref)) {
      return item.label;
    }
    if (item.subitems && item.subitems.length > 0) {
      const found = findChapterTitle(item.subitems, href);
      if (found) return found;
    }
  }
  return undefined;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Load an EPUB from its signed URL and expose its chapters for review.
 * The caller owns `destroy()`.
 */
export async function loadCreatorBook(url: string): Promise<CreatorBook> {
  const loader = createEpubLoader();
  try {
    await loader.load(url);
    const book = loader.getBook() as BookLike | null;
    if (book?.ready) await book.ready;
    if (typeof book?.load !== 'function') {
      throw new Error('book spine is unavailable');
    }
    const sections = collectSpineSections<SpineSectionLike>(book);
    if (sections.length === 0 || sections.some((section) => !section.href)) {
      throw new Error('book has no spine sections');
    }
    const toc = loader.getToc();
    const chapters: BookChapter[] = sections.map((section, position) => ({
      ref: section.href,
      title: findChapterTitle(toc, section.href) ?? section.href,
      index: typeof section.index === 'number' ? section.index : position,
    }));
    const language = loader.getMetadata().language ?? null;
    const loadSection = book.load.bind(book);

    return {
      chapters,
      language,
      async extract(refs?: readonly string[]): Promise<ExtractedChapters> {
        const wanted = refs ? new Set(refs) : null;
        const chapterText: Record<string, string> = {};
        const chapterSha256: Record<string, string> = {};
        for (const section of sections) {
          if (wanted && !wanted.has(section.href)) continue;
          await section.load(loadSection);
          try {
            const text = section.contents?.textContent ?? '';
            chapterText[section.href] = text;
            chapterSha256[section.href] = `sha256:${await sha256Hex(text)}`;
          } finally {
            section.unload();
          }
        }
        return { chapterText, chapterSha256 };
      },
      destroy(): void {
        loader.destroy();
      },
    };
  } catch (error) {
    loader.destroy();
    throw error;
  }
}

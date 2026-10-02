import type { Book } from '@intity/epub-js';
import type { EpubBookInternals } from './epub-internals';
import { parseAccessibilityFromOpf, parseFixedLayoutFromOpf } from '@do-epub-studio/reader-core';
import type { BookInfo } from './epub-init';

export interface BookPresentation {
  /** Title/creator/publisher/language/description plus optional a11y metadata. */
  bookInfo: BookInfo;
  /** True when the package declares (or the OPF reports) `pre-paginated`. */
  fixedLayout: boolean;
  /** Package `spread`, when the book is fixed layout. */
  fixedLayoutSpread?: string;
  /** Package `viewport`, when the book is fixed layout. */
  fixedLayoutViewport?: string;
}

/**
 * Reads the metadata, fixed-layout and accessibility signals off a loaded book.
 *
 * Both metadata sources are optional: a book without them still renders, so the
 * failures are swallowed per source — a missing `container.fullPath` must not
 * take down the accessibility pass, and absent metadata must not abort the
 * rendition. Extracted from `useReaderEpub` (ADR-278 line cap) with behaviour
 * unchanged.
 */
export async function resolveBookPresentation(
  book: Book,
  meta: unknown,
): Promise<BookPresentation> {
  let fixedLayout = false;
  let fixedLayoutSpread: string | undefined;
  let fixedLayoutViewport: string | undefined;
  const bookInfo: BookInfo = {
    title: '',
    creator: undefined,
    publisher: undefined,
    language: undefined,
    description: undefined,
  };

  try {
    const metaMap = meta as Map<string, string>;
    bookInfo.title = metaMap.get('title') ?? '';
    bookInfo.creator = metaMap.get('creator');
    bookInfo.publisher = metaMap.get('publisher');
    bookInfo.language = metaMap.get('language');
    bookInfo.description = metaMap.get('description');

    const pkgMeta = book.packaging?.metadata as Map<string, string> | undefined;
    if (pkgMeta?.get('layout') === 'pre-paginated') {
      fixedLayout = true;
      fixedLayoutSpread = pkgMeta.get('spread') ?? undefined;
      fixedLayoutViewport = pkgMeta.get('viewport') ?? undefined;
    }
    try {
      const opfPath = (book as EpubBookInternals).container?.fullPath;
      if (opfPath && book.archive) {
        const opfXml = await book.archive.getText('/' + opfPath);
        if (opfXml) {
          const fl = parseFixedLayoutFromOpf(opfXml);
          if (fl && !fixedLayout) {
            fixedLayout = fl.layout === 'pre-paginated';
            fixedLayoutSpread = fixedLayoutSpread ?? fl.spread;
            fixedLayoutViewport = fixedLayoutViewport ?? fl.viewport;
          }
          bookInfo.accessibility = parseAccessibilityFromOpf(opfXml);
        }
      }
    } catch {
      // accessibility metadata is optional
    }
  } catch {
    // book metadata is optional
  }

  return { bookInfo, fixedLayout, fixedLayoutSpread, fixedLayoutViewport };
}

/**
 * epub.js `spread` option: the package decides for fixed-layout books
 * (`none`/`both`/`landscape`), otherwise an RTL book opens on the right.
 */
export function resolveEffectiveSpread(
  fixedLayout: boolean,
  fixedLayoutSpread: string | undefined,
  bookDirection: 'ltr' | 'rtl' | 'default',
): string {
  if (!fixedLayout) return bookDirection === 'rtl' ? 'right' : 'auto';
  if (fixedLayoutSpread === 'none') return 'none';
  if (fixedLayoutSpread === 'both') return 'both';
  if (fixedLayoutSpread === 'landscape') return 'landscape';
  return bookDirection === 'rtl' ? 'right' : 'auto';
}

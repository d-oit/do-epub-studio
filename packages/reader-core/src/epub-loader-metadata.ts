import type { Book } from '@intity/epub-js';
import type { SpineItem as EpubSpineItem } from '@intity/epub-js/types/section';
import type { BookMetadata, SpineItem, TocItem } from './epub-types';
import { parseNavigationToc } from './toc';
import { resolveBookDirection, resolveFixedLayoutFromMeta } from './fixed-layout';

interface LoadedEpubMetadataInput {
  book: Book;
  rawNav: { toc?: unknown } | null;
  rawMeta: Map<string, string> | null;
  rawSpine: unknown;
}

interface LoadedEpubMetadata {
  toc?: TocItem[];
  spineItems?: SpineItem[];
  metadata?: BookMetadata;
}

function getSpineIterable(spine: unknown): EpubSpineItem[] {
  if (!spine) return [];
  if (Array.isArray(spine)) return spine as EpubSpineItem[];
  if (spine instanceof Map) return Array.from(spine.values()) as EpubSpineItem[];
  if (typeof (spine as Iterable<EpubSpineItem>)[Symbol.iterator] === 'function') {
    return Array.from(spine as Iterable<EpubSpineItem>);
  }
  return [];
}

function parseSpineFromRaw(spine: unknown): SpineItem[] {
  const spineItems: SpineItem[] = [];
  let index = 0;
  for (const item of getSpineIterable(spine)) {
    spineItems.push({
      index: item.index ?? index,
      href: item.href ?? '',
      properties: item.properties?.join(' '),
    });
    index++;
  }
  return spineItems;
}

export function parseLoadedEpubMetadata({
  book,
  rawNav,
  rawMeta,
  rawSpine,
}: LoadedEpubMetadataInput): LoadedEpubMetadata {
  const result: LoadedEpubMetadata = {};
  if (rawNav && 'toc' in rawNav && rawNav.toc) {
    result.toc = parseNavigationToc(rawNav.toc as Parameters<typeof parseNavigationToc>[0]);
  }
  if (rawSpine !== null && rawSpine !== undefined) {
    result.spineItems = parseSpineFromRaw(rawSpine);
  }

  const packagedMetadata = book.packaging?.metadata as Map<string, string> | undefined;
  if (!rawMeta && !packagedMetadata) return result;
  const getMetadataValue = (key: string) => rawMeta?.get(key) ?? packagedMetadata?.get(key);
  result.metadata = {
    title: getMetadataValue('title') ?? '',
    creator: getMetadataValue('creator'),
    language: getMetadataValue('language'),
    publisher: getMetadataValue('publisher'),
    description: getMetadataValue('description'),
    direction: resolveBookDirection(book.packaging?.direction),
    fixedLayout: resolveFixedLayoutFromMeta(packagedMetadata),
  };
  return result;
}

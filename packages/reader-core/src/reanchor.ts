import type { TocItem } from './epub-types';
import type { LocatorResult } from './locator';

export interface ReanchorResult {
  success: boolean;
  cfi?: string;
  chapterHref?: string;
  fallback: boolean;
  matchType?: 'exact' | 'fuzzy' | 'partial';
  message?: string;
}

export interface AnnotationAnchor {
  cfi?: string;
  selectedText: string;
  chapterRef?: string;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\n\r]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function findPartialMatches(
  normalizedTarget: string,
  normalizedContent: string,
  minLength = 20,
): { match: string; position: number } | null {
  if (normalizedTarget.length < minLength) return null;

  for (let len = normalizedTarget.length; len >= minLength; len -= 5) {
    for (let i = 0; i <= normalizedTarget.length - len; i += Math.max(1, Math.floor(len / 4))) {
      const segment = normalizedTarget.slice(i, i + len);
      const pos = normalizedContent.indexOf(segment);
      if (pos !== -1) {
        return { match: segment, position: pos };
      }
    }
  }

  return null;
}

export async function reanchorByText(
  targetText: string,
  toc: TocItem[],
  loadChapterContent: (href: string) => Promise<string>,
  options: { fuzzyThreshold?: number; preferChapter?: string } = {},
): Promise<ReanchorResult> {
  const { preferChapter } = options;

  if (targetText.length < 10) {
    return { success: false, fallback: true, message: 'Text too short for reanchoring' };
  }

  const normalizedTargetLower = targetText.toLowerCase();
  const normalizedTargetGeneral = normalizeText(targetText);
  const words = normalizedTargetGeneral.split(/\s+/).filter((w) => w.length > 3);

  interface CachedChapter {
    lower: string;
    general?: string;
    content: string;
  }
  const cache = new Map<string, CachedChapter>();

  async function getCachedData(href: string): Promise<CachedChapter> {
    const cached = cache.get(href);
    if (cached) return cached;

    const content = await loadChapterContent(href);
    const result: CachedChapter = {
      lower: content.toLowerCase(),
      content,
    };
    cache.set(href, result);
    return result;
  }

  const flattenedToc: string[] = [];
  const collectHrefs = (items: TocItem[]) => {
    for (const item of items) {
      flattenedToc.push(item.href);
      if (item.subitems) collectHrefs(item.subitems);
    }
  };
  collectHrefs(toc);

  const prioritizedHrefs = preferChapter
    ? [
        ...flattenedToc.filter((href) => href === preferChapter || href.includes(preferChapter)),
        ...flattenedToc.filter((href) => href !== preferChapter && !href.includes(preferChapter)),
      ]
    : flattenedToc;

  const uniqueHrefs = [...new Set(prioritizedHrefs)];

  // Pass 1: Exact and Partial matches
  for (const href of uniqueHrefs) {
    try {
      const cached = await getCachedData(href);

      const exactIndex = cached.lower.indexOf(normalizedTargetLower);
      if (exactIndex !== -1) {
        return {
          success: true,
          chapterHref: href,
          fallback: false,
          matchType: 'exact',
        };
      }

      if (!cached.general) {
        cached.general = normalizeText(cached.content);
      }

      const partial = findPartialMatches(normalizedTargetGeneral, cached.general);
      if (partial) {
        return {
          success: true,
          chapterHref: href,
          fallback: false,
          matchType: 'partial',
          message: `Partial match found at position ${partial.position}`,
        };
      }
    } catch {
      continue;
    }
  }

  // Pass 2: Fuzzy word overlap
  for (const href of uniqueHrefs) {
    try {
      const cached = await getCachedData(href);
      if (!cached.general) {
        cached.general = normalizeText(cached.content);
      }

      let matchCount = 0;
      for (const word of words) {
        if (cached.general.includes(word)) {
          matchCount++;
        }
      }

      if (words.length > 0 && matchCount / words.length >= 0.7) {
        return {
          success: true,
          chapterHref: href,
          fallback: true,
          matchType: 'fuzzy',
          message: 'Fuzzy match based on word overlap',
        };
      }
    } catch {
      continue;
    }
  }

  return {
    success: false,
    fallback: true,
    message: 'Could not find target text in any chapter',
  };
}

export async function tryReanchor(
  anchor: AnnotationAnchor,
  toc: TocItem[],
  loadChapterContent: (href: string) => Promise<string>,
): Promise<{ anchor: AnnotationAnchor; reanchorResult: ReanchorResult }> {
  if (anchor.selectedText.length < 10) {
    return {
      anchor,
      reanchorResult: {
        success: false,
        fallback: true,
        message: 'Text too short for reanchoring',
      },
    };
  }

  const result = await reanchorByText(anchor.selectedText, toc, loadChapterContent, {
    preferChapter: anchor.chapterRef,
  });

  if (result.success && result.chapterHref) {
    return {
      anchor: {
        ...anchor,
        chapterRef: result.chapterHref,
      },
      reanchorResult: result,
    };
  }

  return { anchor, reanchorResult: result };
}

export function findBestChapterMatch(locator: LocatorResult, toc: TocItem[]): TocItem | null {
  if (!locator.chapterHref) return null;

  const found = toc.find((item) => item.href === locator.chapterHref);
  if (found) return found;

  for (const item of toc) {
    if (item.subitems) {
      const subFound = item.subitems.find((sub) => sub.href === locator.chapterHref);
      if (subFound) return subFound;
    }
  }

  return toc[0] || null;
}

export function shouldShowDriftWarning(
  result: ReanchorResult,
  originalChapter: string | undefined,
): boolean {
  if (!result.success) return true;
  if (result.matchType === 'fuzzy') return true;
  if (result.matchType === 'partial') return true;
  if (originalChapter && result.chapterHref && result.chapterHref !== originalChapter) return true;
  return false;
}

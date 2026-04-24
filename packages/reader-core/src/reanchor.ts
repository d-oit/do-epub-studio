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
  content: string,
  minLength = 20,
): { match: string; position: number } | null {
  const normalizedContent = normalizeText(content);

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

  const prioritizedToc = preferChapter
    ? [
        ...toc.filter((item) => item.href === preferChapter || item.href.includes(preferChapter)),
        ...toc.filter((item) => item.href !== preferChapter && !item.href.includes(preferChapter)),
      ]
    : toc;

  // Pass 1: Exact and Partial matches
  for (const item of prioritizedToc) {
    try {
      const content = await loadChapterContent(item.href);
      const normalizedContent = content.toLowerCase();

      const exactIndex = normalizedContent.indexOf(normalizedTargetLower);
      if (exactIndex !== -1) {
        return {
          success: true,
          chapterHref: item.href,
          fallback: false,
          matchType: 'exact',
        };
      }

      const partial = findPartialMatches(normalizedTargetGeneral, content);
      if (partial) {
        return {
          success: true,
          chapterHref: item.href,
          fallback: false,
          matchType: 'partial',
          message: `Partial match found at position ${partial.position}`,
        };
      }

      if (item.subitems) {
        for (const subitem of item.subitems) {
          try {
            const subContent = await loadChapterContent(subitem.href);
            const subNormalized = subContent.toLowerCase();

            const subExact = subNormalized.indexOf(normalizedTargetLower);
            if (subExact !== -1) {
              return {
                success: true,
                chapterHref: subitem.href,
                fallback: false,
                matchType: 'exact',
              };
            }

            const subPartial = findPartialMatches(normalizedTargetGeneral, subContent);
            if (subPartial) {
              return {
                success: true,
                chapterHref: subitem.href,
                fallback: false,
                matchType: 'partial',
                message: `Partial match found at position ${subPartial.position}`,
              };
            }
          } catch {
            continue;
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Pass 2: Fuzzy word overlap
  for (const item of prioritizedToc) {
    try {
      const content = await loadChapterContent(item.href);
      const normalizedContent = normalizeText(content);

      let matchCount = 0;

      for (const word of words) {
        if (normalizedContent.includes(word)) {
          matchCount++;
        }
      }

      if (words.length > 0 && matchCount / words.length >= 0.7) {
        return {
          success: true,
          chapterHref: item.href,
          fallback: true,
          matchType: 'fuzzy',
          message: 'Fuzzy match based on word overlap',
        };
      }

      if (item.subitems) {
        for (const subitem of item.subitems) {
          try {
            const subContent = await loadChapterContent(subitem.href);
            const subNormalized = normalizeText(subContent);

            let subMatchCount = 0;
            for (const word of words) {
              if (subNormalized.includes(word)) {
                subMatchCount++;
              }
            }

            if (words.length > 0 && subMatchCount / words.length >= 0.7) {
              return {
                success: true,
                chapterHref: subitem.href,
                fallback: true,
                matchType: 'fuzzy',
                message: 'Fuzzy match based on word overlap',
              };
            }
          } catch {
            continue;
          }
        }
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

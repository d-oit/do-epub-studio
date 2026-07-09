import type { TocItem } from './epub-types';
import type { LocatorResult } from './locator';

const TARGET_TEXT_MAX_LEN = 1024 * 1024;
const CHAPTER_CONTENT_MAX_LEN = 4 * 1024 * 1024;

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

export function normalizeText(text: string, isAlreadyLower = false): string {
  return (isAlreadyLower ? text : text.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPartialMatches(
  normalizedTarget: string,
  normalizedContent: string,
  minLength = 20,
): { match: string; position: number } | null {
  if (normalizedTarget.length < minLength || normalizedContent.length < minLength) return null;

  for (let len = Math.min(normalizedTarget.length, normalizedContent.length); len >= minLength; len -= 5) {
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
  let normalizedTargetGeneral: string | undefined;
  let words: string[] | undefined;

  interface CachedChapter {
    lower: string;
    general?: string;
    wordSet?: Set<string>;
  }
  const cache = new Map<string, CachedChapter>();

  async function getCachedData(href: string): Promise<CachedChapter> {
    const hashIdx = href.indexOf('#');
    const base = hashIdx === -1 ? href : href.substring(0, hashIdx);
    const cached = cache.get(base);
    if (cached) return cached;

    const content = await loadChapterContent(base);
    const result: CachedChapter = {
      lower: content.toLowerCase(),
    };
    cache.set(base, result);
    return result;
  }

  const baseToHref = new Map<string, string>();
  // Use iterative stack-based traversal to avoid recursion overhead
  const stack: TocItem[] = [];
  for (const item of [...toc].reverse()) {
    stack.push(item);
  }

  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) continue;

    const href = item.href;
    const hashIdx = href.indexOf('#');
    const base = hashIdx === -1 ? href : href.substring(0, hashIdx);
    if (!baseToHref.has(base)) {
      baseToHref.set(base, href);
    }

    if (item.subitems) {
      for (const sub of [...item.subitems].reverse()) {
        stack.push(sub);
      }
    }
  }

  let basePrefer: string | undefined;
  if (preferChapter) {
    const hashIdx = preferChapter.indexOf('#');
    basePrefer = hashIdx === -1 ? preferChapter : preferChapter.substring(0, hashIdx);
  }

  let uniqueHrefs: string[];
  if (basePrefer) {
    const primary: string[] = [];
    const secondary: string[] = [];
    for (const [base, href] of baseToHref) {
      if (base === basePrefer) {
        primary.push(href);
      } else {
        secondary.push(href);
      }
    }
    uniqueHrefs = [...primary, ...secondary];
  } else {
    uniqueHrefs = Array.from(baseToHref.values());
  }

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

      if (cached.general === undefined) {
        cached.general = normalizeText(cached.lower, true);
      }

      if (normalizedTargetGeneral === undefined) {
        normalizedTargetGeneral = normalizeText(targetText);
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
  if (words === undefined) {
    if (normalizedTargetGeneral === undefined) {
      normalizedTargetGeneral = normalizeText(targetText);
    }
    const targetToProcess = normalizedTargetGeneral.length <= TARGET_TEXT_MAX_LEN
      ? normalizedTargetGeneral
      : normalizedTargetGeneral.slice(0, TARGET_TEXT_MAX_LEN);
    // Use match() instead of matchAll() to reduce object allocations
    words = targetToProcess.match(/[\p{L}\p{N}]{4,}/gu) || [];
  }

  const threshold = options.fuzzyThreshold ?? 0.7;
  const targetMatchCount = Math.ceil(words.length * threshold);

  if (words.length > 0) {
    for (const href of uniqueHrefs) {
      try {
        const cached = await getCachedData(href);
        if (cached.wordSet === undefined) {
          cached.wordSet = new Set();
          const contentToProcess = cached.lower.length <= CHAPTER_CONTENT_MAX_LEN
            ? cached.lower
            : cached.lower.slice(0, CHAPTER_CONTENT_MAX_LEN);
          // Use match() instead of matchAll() to reduce object allocations
          const matches = contentToProcess.match(/[\p{L}\p{N}]{4,}/gu);
          if (matches) {
            for (const m of matches) {
              cached.wordSet.add(m);
            }
          }
        }

        let matchCount = 0;
        const { wordSet } = cached;
        let processedCount = 0;
        for (const word of words) {
          if (wordSet.has(word)) {
            matchCount++;
            if (matchCount >= targetMatchCount) {
              return {
                success: true,
                chapterHref: href,
                fallback: true,
                matchType: 'fuzzy',
                message: 'Fuzzy match based on word overlap',
              };
            }
          }
          processedCount++;
          if (matchCount + (words.length - processedCount) < targetMatchCount) {
            break; // Impossible to reach threshold
          }
        }
      } catch {
        continue;
      }
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

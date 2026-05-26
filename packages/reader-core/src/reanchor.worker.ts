/// <reference lib="WebWorker" />

interface TocItem {
  id: string;
  label: string;
  href: string;
  subitems?: TocItem[];
}

interface ReanchorResult {
  success: boolean;
  cfi?: string;
  chapterHref?: string;
  fallback: boolean;
  matchType?: 'exact' | 'fuzzy' | 'partial';
  message?: string;
}

interface ReanchorRequest {
  type: 'reanchor';
  id: string;
  targetText: string;
  toc: TocItem[];
  chapterContents: Record<string, string>;
  fuzzyThreshold?: number;
  preferChapter?: string;
}

interface ResultMessage {
  type: 'result';
  id: string;
  result: ReanchorResult;
}

function normalizeText(text: string, isAlreadyLower = false): string {
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

function performReanchor(
  targetText: string,
  toc: TocItem[],
  chapterContents: Record<string, string>,
  options: { fuzzyThreshold?: number; preferChapter?: string } = {},
): ReanchorResult {
  const { preferChapter } = options;

  if (targetText.length < 10) {
    return { success: false, fallback: true, message: 'Text too short for reanchoring' };
  }

  const normalizedTargetLower = targetText.toLowerCase();
  const normalizedTargetGeneral = normalizeText(targetText);
  const words = normalizedTargetGeneral.match(/[\p{L}\p{N}]{4,}/gu) || [];

  const cache = new Map<string, { lower: string; general: string | undefined; wordSet: Set<string> | undefined }>();

  function getCachedData(href: string) {
    const base = href.split('#')[0] ?? '';
    const cached = cache.get(base);
    if (cached) return cached;

    const content = chapterContents[base];
    if (!content) return null;

    const result: { lower: string; general: string | undefined; wordSet: Set<string> | undefined } = {
      lower: content.toLowerCase(),
      general: undefined,
      wordSet: undefined,
    };
    cache.set(base, result);
    return result;
  }

  const baseToHref = new Map<string, string>();
  const collectHrefs = (items: TocItem[]) => {
    for (const item of items) {
      const base = item.href.split('#')[0] ?? '';
      if (!baseToHref.has(base)) {
        baseToHref.set(base, item.href);
      }
      if (item.subitems) collectHrefs(item.subitems);
    }
  };
  collectHrefs(toc);

  const basePrefer = preferChapter?.split('#')[0];

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
    uniqueHrefs = [...baseToHref.values()];
  }

  // Pass 1: Exact and Partial matches
  for (const href of uniqueHrefs) {
    const cached = getCachedData(href);
    if (!cached) continue;

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
  }

  // Pass 2: Fuzzy word overlap
  const threshold = options.fuzzyThreshold ?? 0.7;
  const targetMatchCount = Math.ceil(words.length * threshold);

  if (words.length > 0) {
    for (const href of uniqueHrefs) {
      const cached = getCachedData(href);
      if (!cached) continue;

      if (cached.wordSet === undefined) {
        cached.wordSet = new Set(cached.lower.match(/[\p{L}\p{N}]{4,}/gu) || []);
      }

      let matchCount = 0;
      const { wordSet } = cached;
      for (const [i, word] of words.entries()) {
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
        if (matchCount + (words.length - 1 - i) < targetMatchCount) {
          break;
        }
      }
    }
  }

  return {
    success: false,
    fallback: true,
    message: 'Could not find target text in any chapter',
  };
}

self.onmessage = (event: MessageEvent<ReanchorRequest>) => {
  const data = event.data;

  if (data.type === 'reanchor') {
    const result = performReanchor(
      data.targetText,
      data.toc,
      data.chapterContents,
      { fuzzyThreshold: data.fuzzyThreshold, preferChapter: data.preferChapter },
    );

    const msg: ResultMessage = {
      type: 'result',
      id: data.id,
      result,
    };
    self.postMessage(msg);
  }
};

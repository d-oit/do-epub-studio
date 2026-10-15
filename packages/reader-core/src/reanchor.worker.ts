/// <reference lib="WebWorker" />

import type { TocItem } from './epub-types';
import {
  ExactCfiStrategy,
  TextPositionStrategy,
  ExactAndPartialQuoteStrategy,
  FuzzyWordOverlapStrategy,
  type ReanchorStrategy,
  type StrategyContext,
  type AnnotationAnchor,
  type CachedChapter,
} from './reanchor-strategies';

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
  anchor?: AnnotationAnchor;
}

interface ResultMessage {
  type: 'result';
  id: string;
  result: ReanchorResult;
}

const pass1Strategies: ReanchorStrategy[] = [
  new ExactCfiStrategy(),
  new TextPositionStrategy(),
  new ExactAndPartialQuoteStrategy(),
];

const pass2Strategies: ReanchorStrategy[] = [new FuzzyWordOverlapStrategy()];

function performReanchor(
  targetText: string,
  toc: TocItem[],
  chapterContents: Record<string, string>,
  options: {
    fuzzyThreshold?: number;
    preferChapter?: string;
    anchor?: AnnotationAnchor;
  } = {},
): ReanchorResult {
  const { preferChapter } = options;

  if (targetText.length < 10) {
    return { success: false, fallback: true, message: 'Text too short for reanchoring' };
  }

  const anchor: AnnotationAnchor = options.anchor ?? {
    selectedText: targetText,
    chapterRef: preferChapter,
  };

  const baseToHref = new Map<string, string>();
  const collectHrefs = (items: TocItem[]) => {
    for (const item of items) {
      const base = item.href.split('#')[0] ?? item.href;
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

  const cache = new Map<string, CachedChapter>();
  function getCachedData(base: string): CachedChapter | null {
    const cached = cache.get(base);
    if (cached) return cached;
    const content = chapterContents[base];
    if (!content) return null;
    const result: CachedChapter = {
      content,
      lower: content.toLowerCase(),
    };
    cache.set(base, result);
    return result;
  }

  // Pass 1: High-precision matches across ALL candidate chapters
  for (const href of uniqueHrefs) {
    const base = href.split('#')[0] ?? href;
    const cached = getCachedData(base);
    if (!cached) continue;

    const ctx: StrategyContext = {
      anchor,
      chapterHref: href,
      cached,
      fuzzyThreshold: options.fuzzyThreshold,
    };

    for (const strategy of pass1Strategies) {
      const result = strategy.execute(ctx);
      if (result) {
        return result;
      }
    }
  }

  // Pass 2: Lower-precision fallback matches across ALL candidate chapters
  for (const href of uniqueHrefs) {
    const base = href.split('#')[0] ?? href;
    const cached = getCachedData(base);
    if (!cached) continue;

    const ctx: StrategyContext = {
      anchor,
      chapterHref: href,
      cached,
      fuzzyThreshold: options.fuzzyThreshold,
    };

    for (const strategy of pass2Strategies) {
      const result = strategy.execute(ctx);
      if (result) {
        return result;
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
    const result = performReanchor(data.targetText, data.toc, data.chapterContents, {
      fuzzyThreshold: data.fuzzyThreshold,
      preferChapter: data.preferChapter,
      anchor: data.anchor,
    });

    const msg: ResultMessage = {
      type: 'result',
      id: data.id,
      result,
    };
    self.postMessage(msg);
  }
};

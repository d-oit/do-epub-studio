/// <reference lib="WebWorker" />

import type { TocItem } from './epub-types';
import {
  TextPositionStrategy,
  ExactAndPartialQuoteStrategy,
  FuzzyWordOverlapStrategy,
  type ReanchorStrategy,
  type StrategyContext,
  type AnnotationAnchor,
  type CachedChapter,
  type ReanchorResult,
} from './reanchor-strategies';

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

  const pass1Results: ReanchorResult[] = [];
  const ambiguousPass1: ReanchorResult[] = [];
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
      if (!result) continue;
      if (result.success) pass1Results.push(result);
      else if (result.ambiguous) ambiguousPass1.push(result);
      break;
    }
  }

  const preciseMatch = chooseBestCandidate(pass1Results);
  if (preciseMatch) return preciseMatch;
  const firstPassAmbiguous = ambiguousPass1[0];
  if (firstPassAmbiguous) return firstPassAmbiguous;

  const pass2Results: ReanchorResult[] = [];
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
      if (!result) continue;
      if (result.success) pass2Results.push(result);
      else if (result.ambiguous) ambiguousPass1.push(result);
      break;
    }
  }

  const fallbackMatch = chooseBestCandidate(pass2Results);
  if (fallbackMatch) return fallbackMatch;
  const fallbackAmbiguous = ambiguousPass1[0];
  if (fallbackAmbiguous) return fallbackAmbiguous;

  return {
    success: false,
    fallback: true,
    message: 'Could not find target text in any chapter',
  };
}
function chooseBestCandidate(candidates: ReanchorResult[]): ReanchorResult | null {
  if (candidates.length === 0) return null;
  let bestConfidence = 0;
  for (const candidate of candidates) {
    bestConfidence = Math.max(bestConfidence, candidate.confidence ?? 0);
  }
  const best = candidates.filter((candidate) => (candidate.confidence ?? 0) === bestConfidence);
  if (best.length === 1) return best[0] ?? null;
  return {
    success: false,
    confidence: bestConfidence,
    fallback: true,
    matchType: best[0]?.matchType,
    ambiguous: true,
    message: 'Multiple chapters contain equally confident matches; review required',
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

import type { TocItem } from './epub-types';
import type { LocatorResult } from './locator';
import { checkDeadline, createDeadline } from '@do-epub-studio/shared';
import {
  TextPositionStrategy,
  ExactAndPartialQuoteStrategy,
  FuzzyWordOverlapStrategy,
  normalizeText,
  type ReanchorStrategy,
  type StrategyContext,
  type AnnotationAnchor,
  type CachedChapter,
  type SharedTargetState,
  type ReanchorResult,
} from './reanchor-strategies';

const REANCHOR_TIMEOUT_MS = 15_000;

export type { AnnotationAnchor, ReanchorResult };
export { normalizeText };

const defaultPass1Strategies: ReanchorStrategy[] = [
  new TextPositionStrategy(),
  new ExactAndPartialQuoteStrategy(),
];

const defaultPass2Strategies: ReanchorStrategy[] = [new FuzzyWordOverlapStrategy()];

export async function reanchorByText(
  targetText: string,
  toc: TocItem[],
  loadChapterContent: (href: string) => Promise<string>,
  options: {
    fuzzyThreshold?: number;
    preferChapter?: string;
    timeoutMs?: number;
    traceId?: string;
    anchor?: AnnotationAnchor;
    pass1Strategies?: ReanchorStrategy[];
    pass2Strategies?: ReanchorStrategy[];
  } = {},
): Promise<ReanchorResult> {
  const { preferChapter } = options;
  const timeoutMs = options.timeoutMs ?? REANCHOR_TIMEOUT_MS;
  const traceId = options.traceId;
  const deadline = createDeadline(timeoutMs);

  if (targetText.length < 10) {
    return { success: false, fallback: true, message: 'Text too short for reanchoring' };
  }

  const anchor: AnnotationAnchor = options.anchor ?? {
    selectedText: targetText,
    chapterRef: preferChapter,
  };

  const cache = new Map<string, CachedChapter>();

  async function getCachedData(href: string): Promise<CachedChapter> {
    const base = href.split('#')[0] ?? href;
    const cached = cache.get(base);
    if (cached) return cached;

    const content = await loadChapterContent(base);
    const result: CachedChapter = {
      content,
      lower: content.toLowerCase(),
    };
    cache.set(base, result);
    return result;
  }

  const uniqueHrefs = getUniqueHrefsFromToc(toc, preferChapter);
  const pass1 = options.pass1Strategies ?? defaultPass1Strategies;
  const pass2 = options.pass2Strategies ?? defaultPass2Strategies;

  const sharedTargetState: SharedTargetState = {};

  // Pass 1: High-precision matches (Exact CFI, Text Position, Exact/Partial Quote) across ALL candidate chapters
  const pass1Results: ReanchorResult[] = [];
  const ambiguousPass1: ReanchorResult[] = [];
  for (const href of uniqueHrefs) {
    checkDeadline(deadline, 'reanchor-by-text', timeoutMs, traceId);
    try {
      const cached = await getCachedData(href);
      const ctx: StrategyContext = {
        anchor,
        chapterHref: href,
        cached,
        fuzzyThreshold: options.fuzzyThreshold,
        sharedTargetState,
      };

      for (const strategy of pass1) {
        const result = strategy.execute(ctx);
        if (!result) continue;
        if (result.success) pass1Results.push(result);
        else if (result.ambiguous) ambiguousPass1.push(result);
        break;
      }
    } catch {
      continue;
    }
  }

  const preciseMatch = chooseBestCandidate(pass1Results);
  if (preciseMatch) return preciseMatch;
  const firstPassAmbiguous = ambiguousPass1[0];
  if (firstPassAmbiguous) return firstPassAmbiguous;

  const pass2Results: ReanchorResult[] = [];
  for (const href of uniqueHrefs) {
    checkDeadline(deadline, 'reanchor-by-text', timeoutMs, traceId);
    try {
      const cached = await getCachedData(href);
      const ctx: StrategyContext = {
        anchor,
        chapterHref: href,
        cached,
        fuzzyThreshold: options.fuzzyThreshold,
        sharedTargetState,
      };

      for (const strategy of pass2) {
        const result = strategy.execute(ctx);
        if (!result) continue;
        if (result.success) pass2Results.push(result);
        else if (result.ambiguous) ambiguousPass1.push(result);
        break;
      }
    } catch {
      continue;
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

export function applyReanchorResult(
  anchor: AnnotationAnchor,
  result: ReanchorResult,
): AnnotationAnchor {
  if (
    !result.success ||
    result.matchType !== 'exact' ||
    result.confidence === undefined ||
    result.confidence < 0.9 ||
    !result.chapterHref ||
    !result.position
  ) {
    return anchor;
  }

  const updated: AnnotationAnchor = {
    ...anchor,
    chapterRef: result.chapterHref,
    position: result.position,
  };
  delete updated.cfi;
  return updated;
}

function getUniqueHrefsFromToc(toc: TocItem[], preferChapter?: string): string[] {
  const baseToHref = new Map<string, string>();
  const collect = (items: TocItem[]) => {
    for (const item of items) {
      const base = item.href.split('#')[0] ?? item.href;
      if (!baseToHref.has(base)) baseToHref.set(base, item.href);
      if (item.subitems) collect(item.subitems);
    }
  };
  collect(toc);

  const basePrefer = preferChapter?.split('#')[0];
  if (!basePrefer) return Array.from(baseToHref.values());

  const primary: string[] = [];
  const secondary: string[] = [];
  for (const [base, href] of baseToHref) {
    if (base === basePrefer) primary.push(href);
    else secondary.push(href);
  }
  return [...primary, ...secondary];
}

export async function tryReanchor(
  anchor: AnnotationAnchor,
  toc: TocItem[],
  loadChapterContent: (href: string) => Promise<string>,
  options: { timeoutMs?: number; traceId?: string } = {},
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
    anchor,
    timeoutMs: options.timeoutMs,
    traceId: options.traceId,
  });

  return { anchor: applyReanchorResult(anchor, result), reanchorResult: result };
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

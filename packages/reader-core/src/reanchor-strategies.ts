export interface TextPositionSelector {
  start: number;
  end: number;
}

export interface AnnotationAnchor {
  cfi?: string;
  selectedText: string;
  chapterRef?: string;
  prefix?: string;
  suffix?: string;
  position?: TextPositionSelector;
  [key: string]: unknown;
}

export interface CachedChapter {
  content: string;
  lower: string;
  general?: string;
  wordSet?: Set<string>;
}

export interface SharedTargetState {
  normalizedTargetGeneral?: string;
  targetWords?: string[];
}

export interface StrategyContext {
  anchor: AnnotationAnchor;
  chapterHref: string;
  cached: CachedChapter;
  fuzzyThreshold?: number;
  sharedTargetState?: SharedTargetState;
}

export interface ReanchorResult {
  success: boolean;
  chapterHref?: string;
  position?: TextPositionSelector;
  confidence?: number;
  fallback: boolean;
  matchType?: 'exact' | 'fuzzy' | 'partial';
  ambiguous?: boolean;
  message?: string;
}

export interface ReanchorStrategy {
  name: string;
  execute(ctx: StrategyContext): ReanchorResult | null;
}

export function normalizeText(text: string, isAlreadyLower = false): string {
  return (isAlreadyLower ? text : text.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function sameChapter(anchorHref: string | undefined, chapterHref: string): boolean {
  return anchorHref !== undefined && anchorHref.split('#')[0] === chapterHref.split('#')[0];
}

/**
 * Strategy 2: Text Position Selector Strategy (Pass 1)
 */
export class TextPositionStrategy implements ReanchorStrategy {
  readonly name = 'text-position';

  execute(ctx: StrategyContext): ReanchorResult | null {
    const { anchor, chapterHref, cached } = ctx;
    if (!anchor.position || !sameChapter(anchor.chapterRef, chapterHref)) return null;

    const { start, end } = anchor.position;
    const content = cached.content;
    if (start < 0 || end <= start || end > content.length) return null;

    const slice = content.slice(start, end);
    const normalizedSlice = normalizeText(slice);
    const normalizedTarget = normalizeText(anchor.selectedText);

    if (normalizedSlice !== normalizedTarget || normalizedTarget.length < 10) return null;

    return {
      success: true,
      chapterHref,
      position: { start, end },
      confidence: 0.99,
      fallback: false,
      matchType: 'exact',
      message: `Matched via text position selector [${start}, ${end}]`,
    };
  }
}

/**
 * Strategy 3: Exact & Partial Quote Matching Strategy (Pass 1)
 */
export class ExactAndPartialQuoteStrategy implements ReanchorStrategy {
  readonly name = 'exact-partial-quote';

  execute(ctx: StrategyContext): ReanchorResult | null {
    const { anchor, chapterHref, cached, sharedTargetState } = ctx;
    const { selectedText, prefix, suffix } = anchor;

    if (selectedText.length < 10) return null;

    const lowerContent = cached.lower;
    const lowerTarget = selectedText.toLowerCase();
    const lowerPrefix = prefix?.trim().toLowerCase() ?? '';
    const lowerSuffix = suffix?.trim().toLowerCase() ?? '';
    const hasContext = lowerPrefix.length > 0 || lowerSuffix.length > 0;
    let exactCount = 0;
    let bestContextScore = -1;
    let bestContextCount = 0;
    let bestIndex = -1;
    let hasUnmappedMatch = false;

    for (
      let exactIndex = lowerContent.indexOf(lowerTarget);
      exactIndex !== -1;
      exactIndex = lowerContent.indexOf(lowerTarget, exactIndex + 1)
    ) {
      const rawMatch = cached.content.slice(exactIndex, exactIndex + selectedText.length);
      if (rawMatch.length !== selectedText.length || rawMatch.toLowerCase() !== lowerTarget) {
        hasUnmappedMatch = true;
        continue;
      }

      exactCount++;
      let contextScore = 0;
      if (lowerPrefix) {
        const precedingText = lowerContent.slice(
          Math.max(0, exactIndex - lowerPrefix.length - 20),
          exactIndex,
        );
        if (precedingText.includes(lowerPrefix)) contextScore++;
      }
      if (lowerSuffix) {
        const followingText = lowerContent.slice(
          exactIndex + lowerTarget.length,
          exactIndex + lowerTarget.length + lowerSuffix.length + 20,
        );
        if (followingText.includes(lowerSuffix)) contextScore++;
      }

      if (contextScore > bestContextScore) {
        bestContextScore = contextScore;
        bestContextCount = 1;
        bestIndex = exactIndex;
      } else if (contextScore === bestContextScore) {
        bestContextCount++;
      }
    }

    if (exactCount > 0 || hasUnmappedMatch) {
      if (
        hasUnmappedMatch ||
        (exactCount > 1 && (!hasContext || bestContextScore === 0 || bestContextCount !== 1))
      ) {
        return {
          success: false,
          chapterHref,
          confidence: 0.5,
          fallback: true,
          matchType: 'exact',
          ambiguous: true,
          message: 'Repeated exact quote has no unique prefix/suffix match',
        };
      }

      return {
        success: true,
        chapterHref,
        position: { start: bestIndex, end: bestIndex + selectedText.length },
        confidence: 0.95 + Math.max(0, bestContextScore) * 0.02,
        fallback: false,
        matchType: 'exact',
        message:
          bestContextScore > 0
            ? `Exact quote match with prefix/suffix context score ${bestContextScore}`
            : 'Exact quote match',
      };
    }

    if (cached.general === undefined) {
      cached.general = normalizeText(cached.lower, true);
    }

    if (sharedTargetState) {
      if (sharedTargetState.normalizedTargetGeneral === undefined) {
        sharedTargetState.normalizedTargetGeneral = normalizeText(selectedText);
      }
    }
    const generalTarget = sharedTargetState?.normalizedTargetGeneral ?? normalizeText(selectedText);

    const partial = this.findPartialMatches(generalTarget, cached.general);
    if (!partial) return null;

    return {
      success: true,
      chapterHref,
      confidence: 0.65,
      fallback: true,
      matchType: 'partial',
      message: `Partial match found at normalized position ${partial.position}; review required`,
    };
  }

  private findPartialMatches(
    normalizedTarget: string,
    normalizedContent: string,
    minLength = 20,
  ): { match: string; position: number } | null {
    if (normalizedTarget.length < minLength || normalizedContent.length < minLength) return null;

    for (
      let len = Math.min(normalizedTarget.length, normalizedContent.length);
      len >= minLength;
      len -= 5
    ) {
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
}

/**
 * Strategy 4: Fuzzy Word Overlap Matching Strategy (Pass 2 Fallback)
 */
export class FuzzyWordOverlapStrategy implements ReanchorStrategy {
  readonly name = 'fuzzy-word-overlap';

  execute(ctx: StrategyContext): ReanchorResult | null {
    const { anchor, chapterHref, cached, fuzzyThreshold = 0.7, sharedTargetState } = ctx;
    const { selectedText } = anchor;

    if (selectedText.length < 10) return null;

    if (cached.general === undefined) {
      cached.general = normalizeText(cached.lower, true);
    }

    if (sharedTargetState && sharedTargetState.targetWords === undefined) {
      if (sharedTargetState.normalizedTargetGeneral === undefined) {
        sharedTargetState.normalizedTargetGeneral = normalizeText(selectedText);
      }
      const generalTarget = sharedTargetState.normalizedTargetGeneral;
      const targetToProcess =
        generalTarget.length <= 1024 * 1024 ? generalTarget : generalTarget.slice(0, 1024 * 1024);
      const targetWordSet = new Set<string>();
      const wordRegex = /[\p{L}\p{N}]{4,}/gu;
      let match: RegExpExecArray | null;
      while ((match = wordRegex.exec(targetToProcess)) !== null) {
        targetWordSet.add(match[0]);
      }
      sharedTargetState.targetWords = Array.from(targetWordSet);
    }

    let targetWords: string[];
    if (sharedTargetState?.targetWords) {
      targetWords = sharedTargetState.targetWords;
    } else {
      const generalTarget =
        sharedTargetState?.normalizedTargetGeneral ?? normalizeText(selectedText);
      const targetToProcess =
        generalTarget.length <= 1024 * 1024 ? generalTarget : generalTarget.slice(0, 1024 * 1024);
      const targetWordSet = new Set<string>();
      const wordRegex = /[\p{L}\p{N}]{4,}/gu;
      let match: RegExpExecArray | null;
      while ((match = wordRegex.exec(targetToProcess)) !== null) {
        targetWordSet.add(match[0]);
      }
      targetWords = Array.from(targetWordSet);
    }

    if (targetWords.length === 0) return null;

    if (cached.wordSet === undefined) {
      cached.wordSet = this.extractWordSet(cached.lower);
    }

    const contentWordSet = cached.wordSet;
    const targetMatchCount = Math.ceil(targetWords.length * fuzzyThreshold);

    let matchCount = 0;
    let processedCount = 0;
    for (const word of targetWords) {
      if (contentWordSet.has(word)) {
        matchCount++;
        if (matchCount >= targetMatchCount) {
          return {
            success: true,
            chapterHref,
            confidence: 0.35,
            fallback: true,
            matchType: 'fuzzy',
            message: 'Fuzzy word overlap only; position must be confirmed by a reviewer',
          };
        }
      }
      processedCount++;
      if (matchCount + (targetWords.length - processedCount) < targetMatchCount) {
        break;
      }
    }

    return null;
  }

  private extractWordSet(content: string): Set<string> {
    const wordSet = new Set<string>();
    const contentToProcess =
      content.length <= 4 * 1024 * 1024 ? content : content.slice(0, 4 * 1024 * 1024);
    const wordRegex = /[\p{L}\p{N}]{4,}/gu;
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(contentToProcess)) !== null) {
      wordSet.add(match[0]);
    }
    return wordSet;
  }
}

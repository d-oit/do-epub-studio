export type AnchorStatus = 'anchored' | 'migrated' | 'orphaned' | 'needs_review';
export type MigrationOutcome =
  'exact_match' | 'moved_text' | 'ambiguous_match' | 'deleted_text' | 'already_migrated';

export interface MigrationCandidate {
  id: string;
  type?: 'highlight' | 'comment';
  chapterRef?: string | null;
  cfiRange?: string | null;
  selectedText?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  revisionId?: string | null;
  originalCfi?: string | null;
  originalChapterRef?: string | null;
  originalSelectedText?: string | null;
}

export interface ChapterContentItem {
  chapterRef: string;
  content: string;
}

export interface MigrationDecision {
  annotationId: string;
  anchorStatus: AnchorStatus;
  confidence: number;
  migrationOutcome: MigrationOutcome;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string | null;
  originalCfi: string | null;
  originalChapterRef: string | null;
  originalSelectedText: string | null;
  targetRevisionId: string;
}

export interface MigrationReport {
  targetRevisionId: string;
  totalCount: number;
  migratedCount: number;
  orphanedCount: number;
  needsReviewCount: number;
  decisions: MigrationDecision[];
  outcomes: Record<string, number>;
}

export function normalizeText(text: string, isAlreadyLower = false): string {
  // Match sequences of 2+ whitespace characters first (\s{2,}) or individual non-space
  // whitespace characters ([^\S ]+) while leaving single ASCII space separators untouched.
  return (isAlreadyLower ? text : text.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s{2,}|[^\S ]+/g, ' ')
    .trim();
}

function findPartialMatches(
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

export function migrateAnnotationAnchor(
  candidate: MigrationCandidate,
  chapters: ChapterContentItem[],
  targetRevisionId: string,
): MigrationDecision {
  const originalCfi = candidate.originalCfi ?? candidate.cfiRange ?? null;
  const originalChapterRef = candidate.originalChapterRef ?? candidate.chapterRef ?? null;
  const originalSelectedText = candidate.originalSelectedText ?? candidate.selectedText ?? null;

  if (candidate.revisionId === targetRevisionId) {
    return {
      annotationId: candidate.id,
      anchorStatus: 'migrated',
      confidence: 1.0,
      migrationOutcome: 'already_migrated',
      chapterRef: candidate.chapterRef ?? null,
      cfiRange: candidate.cfiRange ?? null,
      selectedText: candidate.selectedText ?? originalSelectedText,
      originalCfi,
      originalChapterRef,
      originalSelectedText,
      targetRevisionId,
    };
  }

  const textToFind = candidate.selectedText ?? originalSelectedText;

  if (!textToFind || textToFind.trim().length === 0) {
    if (candidate.chapterRef && chapters.some((ch) => ch.chapterRef === candidate.chapterRef)) {
      return {
        annotationId: candidate.id,
        anchorStatus: 'anchored',
        confidence: 0.9,
        migrationOutcome: 'exact_match',
        chapterRef: candidate.chapterRef,
        cfiRange: candidate.cfiRange ?? null,
        selectedText: null,
        originalCfi,
        originalChapterRef,
        originalSelectedText,
        targetRevisionId,
      };
    }
    return {
      annotationId: candidate.id,
      anchorStatus: 'orphaned',
      confidence: 0.0,
      migrationOutcome: 'deleted_text',
      chapterRef: candidate.chapterRef ?? null,
      cfiRange: candidate.cfiRange ?? null,
      selectedText: null,
      originalCfi,
      originalChapterRef,
      originalSelectedText,
      targetRevisionId,
    };
  }

  const normalizedTarget = normalizeText(textToFind);
  if (normalizedTarget.length < 5) {
    return {
      annotationId: candidate.id,
      anchorStatus: 'needs_review',
      confidence: 0.3,
      migrationOutcome: 'ambiguous_match',
      chapterRef: candidate.chapterRef ?? null,
      cfiRange: candidate.cfiRange ?? null,
      selectedText: textToFind,
      originalCfi,
      originalChapterRef,
      originalSelectedText,
      targetRevisionId,
    };
  }

  interface ChapterMatch {
    chapterRef: string;
    isExact: boolean;
    occurrences: number;
  }

  const allMatches: ChapterMatch[] = [];

  for (const ch of chapters) {
    const rawContent = ch.content;
    const lowerContent = rawContent.toLowerCase();
    const lowerTarget = textToFind.toLowerCase();

    let count = 0;
    let pos = lowerContent.indexOf(lowerTarget);
    while (pos !== -1) {
      count++;
      pos = lowerContent.indexOf(lowerTarget, pos + 1);
    }

    if (count > 0) {
      allMatches.push({
        chapterRef: ch.chapterRef,
        isExact: true,
        occurrences: count,
      });
      continue;
    }

    const normContent = normalizeText(rawContent);
    let normCount = 0;
    let nPos = normContent.indexOf(normalizedTarget);
    while (nPos !== -1) {
      normCount++;
      nPos = normContent.indexOf(normalizedTarget, nPos + 1);
    }

    if (normCount > 0) {
      allMatches.push({
        chapterRef: ch.chapterRef,
        isExact: false,
        occurrences: normCount,
      });
    }
  }

  if (allMatches.length === 0) {
    const partialMatches: { chapterRef: string; score: number }[] = [];
    for (const ch of chapters) {
      const normContent = normalizeText(ch.content);
      const minLen = Math.min(20, Math.floor(normalizedTarget.length * 0.6));
      const partial = findPartialMatches(normalizedTarget, normContent, minLen);
      if (partial) {
        const ratio = partial.match.length / normalizedTarget.length;
        if (ratio >= 0.7) {
          partialMatches.push({ chapterRef: ch.chapterRef, score: ratio });
        }
      }
    }

    const firstPartial = partialMatches[0];
    if (partialMatches.length === 1 && firstPartial && firstPartial.score >= 0.75) {
      const isSameChapter = firstPartial.chapterRef === candidate.chapterRef;
      return {
        annotationId: candidate.id,
        anchorStatus: 'migrated',
        confidence: 0.75,
        migrationOutcome: 'moved_text',
        chapterRef: firstPartial.chapterRef,
        cfiRange: isSameChapter ? (candidate.cfiRange ?? null) : null,
        selectedText: textToFind,
        originalCfi,
        originalChapterRef,
        originalSelectedText,
        targetRevisionId,
      };
    }

    if (partialMatches.length > 1) {
      return {
        annotationId: candidate.id,
        anchorStatus: 'needs_review',
        confidence: 0.45,
        migrationOutcome: 'ambiguous_match',
        chapterRef: candidate.chapterRef ?? null,
        cfiRange: candidate.cfiRange ?? null,
        selectedText: textToFind,
        originalCfi,
        originalChapterRef,
        originalSelectedText,
        targetRevisionId,
      };
    }

    return {
      annotationId: candidate.id,
      anchorStatus: 'orphaned',
      confidence: 0.0,
      migrationOutcome: 'deleted_text',
      chapterRef: candidate.chapterRef ?? null,
      cfiRange: candidate.cfiRange ?? null,
      selectedText: textToFind,
      originalCfi,
      originalChapterRef,
      originalSelectedText,
      targetRevisionId,
    };
  }

  const firstMatch = allMatches[0];
  if (allMatches.length === 1 && firstMatch && firstMatch.occurrences === 1) {
    const isSameChapter = firstMatch.chapterRef === candidate.chapterRef;
    return {
      annotationId: candidate.id,
      anchorStatus: isSameChapter && firstMatch.isExact ? 'anchored' : 'migrated',
      confidence: isSameChapter ? (firstMatch.isExact ? 1.0 : 0.95) : 0.85,
      migrationOutcome: isSameChapter && firstMatch.isExact ? 'exact_match' : 'moved_text',
      chapterRef: firstMatch.chapterRef,
      cfiRange: isSameChapter ? (candidate.cfiRange ?? null) : null,
      selectedText: textToFind,
      originalCfi,
      originalChapterRef,
      originalSelectedText,
      targetRevisionId,
    };
  }

  const matchInOrig = allMatches.find(
    (m) => m.chapterRef === candidate.chapterRef && m.occurrences === 1,
  );
  if (matchInOrig) {
    return {
      annotationId: candidate.id,
      anchorStatus: matchInOrig.isExact ? 'anchored' : 'migrated',
      confidence: matchInOrig.isExact ? 0.95 : 0.9,
      migrationOutcome: matchInOrig.isExact ? 'exact_match' : 'moved_text',
      chapterRef: matchInOrig.chapterRef,
      cfiRange: candidate.cfiRange ?? null,
      selectedText: textToFind,
      originalCfi,
      originalChapterRef,
      originalSelectedText,
      targetRevisionId,
    };
  }

  if (candidate.prefix || candidate.suffix) {
    const prefix = candidate.prefix?.trim().toLowerCase() ?? '';
    const suffix = candidate.suffix?.trim().toLowerCase() ?? '';
    let bestMatch: ChapterMatch | null = null;
    let disambiguatedCount = 0;

    for (const m of allMatches) {
      const ch = chapters.find((c) => c.chapterRef === m.chapterRef);
      if (!ch) continue;
      const lower = ch.content.toLowerCase();
      const target = textToFind.toLowerCase();
      let pos = lower.indexOf(target);
      while (pos !== -1) {
        let contextMatches = true;
        if (prefix.length > 0) {
          const actualPrefix = lower.slice(Math.max(0, pos - prefix.length - 20), pos);
          if (!actualPrefix.includes(prefix)) contextMatches = false;
        }
        if (suffix.length > 0) {
          const actualSuffix = lower.slice(
            pos + target.length,
            pos + target.length + suffix.length + 20,
          );
          if (!actualSuffix.includes(suffix)) contextMatches = false;
        }
        if (contextMatches) {
          disambiguatedCount++;
          bestMatch = m;
        }
        pos = lower.indexOf(target, pos + 1);
      }
    }

    if (disambiguatedCount === 1 && bestMatch) {
      const isSameChapter = bestMatch.chapterRef === candidate.chapterRef;
      return {
        annotationId: candidate.id,
        anchorStatus: 'migrated',
        confidence: isSameChapter ? 0.92 : 0.85,
        migrationOutcome: 'moved_text',
        chapterRef: bestMatch.chapterRef,
        cfiRange: isSameChapter ? (candidate.cfiRange ?? null) : null,
        selectedText: textToFind,
        originalCfi,
        originalChapterRef,
        originalSelectedText,
        targetRevisionId,
      };
    }
  }

  return {
    annotationId: candidate.id,
    anchorStatus: 'needs_review',
    confidence: 0.4,
    migrationOutcome: 'ambiguous_match',
    chapterRef: candidate.chapterRef ?? allMatches[0]?.chapterRef ?? null,
    cfiRange: candidate.cfiRange ?? null,
    selectedText: textToFind,
    originalCfi,
    originalChapterRef,
    originalSelectedText,
    targetRevisionId,
  };
}

export function migrateAnnotations(
  candidates: MigrationCandidate[],
  chapters: ChapterContentItem[],
  targetRevisionId: string,
): MigrationReport {
  const decisions: MigrationDecision[] = [];
  const outcomes: Record<string, number> = {
    exact_match: 0,
    moved_text: 0,
    ambiguous_match: 0,
    deleted_text: 0,
    already_migrated: 0,
  };

  let migratedCount = 0;
  let orphanedCount = 0;
  let needsReviewCount = 0;

  for (const candidate of candidates) {
    const decision = migrateAnnotationAnchor(candidate, chapters, targetRevisionId);
    decisions.push(decision);

    outcomes[decision.migrationOutcome] = (outcomes[decision.migrationOutcome] ?? 0) + 1;

    if (decision.anchorStatus === 'anchored' || decision.anchorStatus === 'migrated') {
      migratedCount++;
    } else if (decision.anchorStatus === 'orphaned') {
      orphanedCount++;
    } else if (decision.anchorStatus === 'needs_review') {
      needsReviewCount++;
    }
  }

  return {
    targetRevisionId,
    totalCount: candidates.length,
    migratedCount,
    orphanedCount,
    needsReviewCount,
    decisions,
    outcomes,
  };
}

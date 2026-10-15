import type { ChapterIndexDoc, BookSearchIndexEntry } from '../../../../lib/offline/types';

export interface IndexSearchResult {
  chapterRef: string;
  chapterTitle?: string;
  cfi: string;
  excerpt: string;
  score: number;
}

/**
 * Tokenize text into lowercase terms, supporting multi-language characters via Unicode property escapes.
 */
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  const normalized = text.toLowerCase();
  const matches = normalized.match(/[\p{L}\p{N}]{2,}/gu);
  return matches ?? [];
}

/**
 * Bounded snippet builder surrounding a query match in excerpt text.
 */
export function buildSnippet(text: string, query: string, maxChars = 200): string {
  if (text.length <= maxChars) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx < 0) {
    return `${text.slice(0, maxChars)}\u2026`;
  }

  const half = Math.floor(maxChars / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(text.length, start + maxChars);
  const safeStart = Math.max(0, end - maxChars);

  const prefix = safeStart > 0 ? '\u2026' : '';
  const suffix = end < text.length ? '\u2026' : '';

  return `${prefix}${text.slice(safeStart, end)}${suffix}`;
}

export class TokenIndex {
  private docs: ChapterIndexDoc[] = [];

  constructor(docs: ChapterIndexDoc[] = []) {
    this.docs = docs;
  }

  public setDocs(docs: ChapterIndexDoc[]): void {
    this.docs = docs;
  }

  public getDocs(): ChapterIndexDoc[] {
    return this.docs;
  }

  /**
   * Fast token/substring search across cached docs.
   */
  public search(query: string, maxResults = 50): IndexSearchResult[] {
    const trimmed = query.trim();
    if (trimmed.length < 2 || this.docs.length === 0) return [];

    const lowerQuery = trimmed.toLowerCase();
    const queryTokens = tokenizeText(trimmed);
    const results: IndexSearchResult[] = [];

    for (const doc of this.docs) {
      if (results.length >= maxResults) break;

      const lowerContent = doc.content.toLowerCase();

      // Direct substring search first (highest relevance)
      let idx = lowerContent.indexOf(lowerQuery);
      if (idx >= 0) {
        while (idx >= 0 && results.length < maxResults) {
          const excerpt = buildSnippet(
            doc.content.slice(
              Math.max(0, idx - 100),
              Math.min(doc.content.length, idx + query.length + 100),
            ),
            trimmed,
          );
          const cfi = resolveCfiForOffset(doc, idx);

          results.push({
            chapterRef: doc.chapterRef,
            chapterTitle: doc.chapterTitle,
            cfi,
            excerpt,
            score: 1.0,
          });

          idx = lowerContent.indexOf(lowerQuery, idx + lowerQuery.length);
        }
        continue;
      }

      // Token match fallback
      if (queryTokens.length > 0) {
        let matchedCount = 0;
        let firstMatchIdx = -1;

        for (const token of queryTokens) {
          const pos = lowerContent.indexOf(token);
          if (pos >= 0) {
            matchedCount++;
            if (firstMatchIdx < 0 || pos < firstMatchIdx) {
              firstMatchIdx = pos;
            }
          }
        }

        if (matchedCount > 0) {
          const score = matchedCount / queryTokens.length;
          if (score >= 0.5) {
            const excerpt = buildSnippet(
              doc.content.slice(
                Math.max(0, firstMatchIdx - 100),
                Math.min(doc.content.length, firstMatchIdx + 200),
              ),
              trimmed,
            );
            const cfi = resolveCfiForOffset(doc, firstMatchIdx);

            results.push({
              chapterRef: doc.chapterRef,
              chapterTitle: doc.chapterTitle,
              cfi,
              excerpt,
              score,
            });
          }
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}

function resolveCfiForOffset(doc: ChapterIndexDoc, offset: number): string {
  const cfiMap = doc.cfiMap;
  if (cfiMap && cfiMap.length > 0) {
    let bestCfi = cfiMap[0]?.cfi ?? `epubcfi(/6/2[${doc.chapterRef}]!/4/2:${offset})`;
    for (const item of cfiMap) {
      if (item.offset <= offset) {
        bestCfi = item.cfi;
      } else {
        break;
      }
    }
    return bestCfi;
  }
  return `epubcfi(/6/2[${doc.chapterRef}]!/4/2:${offset})`;
}

export function createBookIndexEntry(
  bookId: string,
  docs: ChapterIndexDoc[],
): BookSearchIndexEntry {
  return {
    bookId,
    chapters: docs,
    updatedAt: Date.now(),
  };
}

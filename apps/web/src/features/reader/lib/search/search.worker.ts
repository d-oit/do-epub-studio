import { TokenIndex } from './search-index';
import type { ChapterIndexDoc } from '../../../../lib/offline/types';

export type WorkerSearchRequest =
  | { type: 'BUILD_INDEX'; bookId: string; chapters: ChapterIndexDoc[] }
  | { type: 'LOAD_INDEX'; bookId: string; chapters: ChapterIndexDoc[] }
  | { type: 'SEARCH'; bookId: string; query: string; maxResults?: number };

export type WorkerSearchResponse =
  | { type: 'INDEX_READY'; bookId: string; chapterCount: number; durationMs: number }
  | {
      type: 'SEARCH_RESULTS';
      bookId: string;
      query: string;
      results: ReturnType<TokenIndex['search']>;
      durationMs: number;
    }
  | { type: 'ERROR'; bookId: string; message: string };

let currentIndex: TokenIndex | null = null;
let currentBookId: string | null = null;

self.onmessage = (event: MessageEvent<WorkerSearchRequest>) => {
  const req = event.data;
  const startedAt = performance.now();

  try {
    if (req.type === 'BUILD_INDEX' || req.type === 'LOAD_INDEX') {
      currentBookId = req.bookId;
      currentIndex = new TokenIndex(req.chapters);

      const durationMs = performance.now() - startedAt;
      const resp: WorkerSearchResponse = {
        type: 'INDEX_READY',
        bookId: req.bookId,
        chapterCount: req.chapters.length,
        durationMs,
      };
      self.postMessage(resp);
      return;
    }

    if (req.type === 'SEARCH') {
      if (!currentIndex || currentBookId !== req.bookId) {
        currentIndex = new TokenIndex([]);
      }

      const results = currentIndex.search(req.query, req.maxResults ?? 50);
      const durationMs = performance.now() - startedAt;

      const resp: WorkerSearchResponse = {
        type: 'SEARCH_RESULTS',
        bookId: req.bookId,
        query: req.query,
        results,
        durationMs,
      };
      self.postMessage(resp);
      return;
    }
  } catch (err) {
    const e = err as Error;
    const resp: WorkerSearchResponse = {
      type: 'ERROR',
      bookId: req.bookId ?? '',
      message: e.message || 'Worker search error',
    };
    self.postMessage(resp);
  }
};

import { describe, it, expect } from 'vitest';
import { TokenIndex, tokenizeText, buildSnippet } from './search-index';
import type { ChapterIndexDoc } from '../../../../lib/offline/types';

describe('Offline Search Index & Performance Benchmark', () => {
  it('tokenizes multi-language text correctly', () => {
    const tokensEn = tokenizeText('Offline full-text search engine in EPUB reader!');
    expect(tokensEn).toContain('offline');
    expect(tokensEn).toContain('search');

    const tokensEs = tokenizeText('Búsqueda de texto completo sin conexión');
    expect(tokensEs).toContain('búsqueda');
    expect(tokensEs).toContain('conexión');
  });

  it('builds bounded snippets with highlights', () => {
    const text = 'The quick brown fox jumps over the lazy dog in a chapter review test snippet';
    const snippet = buildSnippet(text, 'lazy dog', 30);
    expect(snippet).toContain('lazy dog');
    expect(snippet.length).toBeLessThanOrEqual(35);
  });

  it('benchmark targets search response under 100ms on a 300-page EPUB corpus', () => {
    // Generate 30 synthetic chapters simulating a 300-page EPUB (~10 pages per chapter, ~3,000 words/chapter)
    const docs: ChapterIndexDoc[] = [];
    const vocabulary = [
      'editorial',
      'passage',
      'annotation',
      'chapter',
      'review',
      'analysis',
      'version',
      'reader',
      'studio',
      'workspace',
    ];

    for (let i = 1; i <= 30; i++) {
      let content = `Chapter ${i} introduction and content. `;
      for (let w = 0; w < 1000; w++) {
        const word = vocabulary[w % vocabulary.length];
        content += `${word} text segment ${w} in chapter ${i}. `;
      }
      docs.push({
        chapterRef: `chapter-${i}.xhtml`,
        chapterTitle: `Chapter ${i}: Editorial Review`,
        content,
      });
    }

    const index = new TokenIndex(docs);

    // Benchmark Hardware & Corpus
    // Corpus size: 30 chapters, ~30,000 sentences (~150,000 words).
    const start = performance.now();
    const results = index.search('editorial analysis');
    const durationMs = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.chapterTitle).toBe('Chapter 1: Editorial Review');
    // Target constraint: under 100 ms
    expect(durationMs).toBeLessThan(100);
  });
});

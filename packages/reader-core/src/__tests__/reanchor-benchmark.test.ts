import { describe, expect, it } from 'vitest';
import { reanchorByText, type AnnotationAnchor } from '../reanchor';
import type { TocItem } from '../epub-types';

describe('Re-anchoring Performance Benchmark', () => {
  it('re-anchors 100 annotations on a 50 KB chapter under 50 ms', async () => {
    // 1. Build a synthetic ~50 KB chapter (~50,000 characters)
    const paragraphs: string[] = [];
    for (let i = 0; i < 300; i++) {
      paragraphs.push(
        `Paragraph ${i}: The quick brown fox jumps over the lazy dog. In chapter ${i}, important concepts and key editorial findings are discussed in detail with comprehensive explanations. Section ref ${i * 7}.`,
      );
    }
    const chapterText = paragraphs.join('\n\n');
    expect(chapterText.length).toBeGreaterThanOrEqual(45_000);

    const mockToc: TocItem[] = [{ id: 'ch1', label: 'Chapter 1', href: 'chapter1.xhtml' }];
    const loadChapterContent = (_href: string) => Promise.resolve(chapterText);

    // 2. Generate 100 sample annotation anchors across the chapter
    const anchors: AnnotationAnchor[] = [];
    for (let i = 0; i < 100; i++) {
      const targetText = `Paragraph ${i % 250}: The quick brown fox jumps over the lazy dog. In chapter ${i % 250}, important concepts`;
      anchors.push({
        selectedText: targetText,
        chapterRef: 'chapter1.xhtml',
      });
    }

    // 3. Measure total execution time for 100 re-anchoring requests
    const startTime = performance.now();
    for (const anchor of anchors) {
      const res = await reanchorByText(anchor.selectedText, mockToc, loadChapterContent, {
        preferChapter: anchor.chapterRef,
        anchor,
      });
      expect(res.success).toBe(true);
    }
    const durationMs = performance.now() - startTime;

    console.log(
      `[Benchmark] 100 annotations re-anchored on a 50 KB chapter in ${durationMs.toFixed(2)} ms`,
    );

    // 4. Target under 50 ms
    expect(durationMs).toBeLessThan(50);
  });
});

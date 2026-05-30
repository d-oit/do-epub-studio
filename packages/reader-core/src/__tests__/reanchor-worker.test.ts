/**
 * Tests for reanchor-worker.ts (the pool/orchestrator layer).
 *
 * The actual WebWorker (reanchor.worker.ts) cannot run in jsdom, so the pool
 * falls back to calling `reanchorByText` from `./reanchor` directly. These
 * tests exercise the pool's public API, fallback behaviour, edge cases, and
 * the tryReanchor helper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reanchorByText,
  tryReanchor,
  terminateWorker,
} from '../reanchor-worker';
import type { TocItem } from '../epub-types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TOC: TocItem[] = [
  { id: '1', label: 'Chapter 1', href: 'chapter1.xhtml' },
  { id: '2', label: 'Chapter 2', href: 'chapter2.xhtml' },
  {
    id: '3',
    label: 'Chapter 3',
    href: 'chapter3.xhtml',
    subitems: [{ id: '3a', label: 'Section 3A', href: 'section3a.xhtml' }],
  },
];

function makeLoader(
  map: Record<string, string>,
): (href: string) => Promise<string> {
  return (href: string) =>
    href in map
      ? Promise.resolve(map[href] ?? '')
      : Promise.reject(new Error(`Not found: ${href}`));
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  terminateWorker(); // reset global pool between tests
});

// ---------------------------------------------------------------------------
// reanchorByText – CFI matching / text fallback
// ---------------------------------------------------------------------------

describe('reanchorByText (pool fallback)', () => {
  it('returns failure for text that is too short', async () => {
    const result = await reanchorByText('hi', TOC, vi.fn());
    expect(result.success).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.message).toMatch(/too short/i);
  });

  it('finds an exact match in the correct chapter', async () => {
    const loader = makeLoader({
      'chapter1.xhtml': 'The quick brown fox jumps over the lazy dog.',
      'chapter2.xhtml': 'Nothing relevant here.',
      'chapter3.xhtml': 'Nothing relevant here.',
      'section3a.xhtml': 'Nothing relevant here.',
    });
    const result = await reanchorByText('quick brown fox', TOC, loader);
    expect(result.success).toBe(true);
    expect(result.matchType).toBe('exact');
    expect(result.chapterHref).toBe('chapter1.xhtml');
    expect(result.fallback).toBe(false);
  });

  it('prefers the chapter specified via preferChapter', async () => {
    const loader = makeLoader({
      'chapter1.xhtml': 'target text is here',
      'chapter2.xhtml': 'target text is also here',
      'chapter3.xhtml': 'nothing',
      'section3a.xhtml': 'nothing',
    });
    const result = await reanchorByText('target text', TOC, loader, {
      preferChapter: 'chapter2.xhtml',
    });
    expect(result.success).toBe(true);
    expect(result.chapterHref).toBe('chapter2.xhtml');
  });

  it('falls back to fuzzy match when exact/partial not found', async () => {
    const loader = makeLoader({
      'chapter1.xhtml':
        'The chapter discusses important concepts and key ideas about the topic.',
      'chapter2.xhtml': 'nothing',
      'chapter3.xhtml': 'nothing',
      'section3a.xhtml': 'nothing',
    });
    const result = await reanchorByText(
      'important concepts key ideas topic discussion',
      TOC,
      loader,
    );
    expect(result.success).toBe(true);
    expect(result.matchType).toBe('fuzzy');
    expect(result.fallback).toBe(true);
  });

  it('searches subitems when parent chapter has no match', async () => {
    const loader = makeLoader({
      'chapter1.xhtml': 'nothing',
      'chapter2.xhtml': 'nothing',
      'chapter3.xhtml': 'nothing',
      'section3a.xhtml': 'The target text lives in the subsection.',
    });
    const result = await reanchorByText('target text', TOC, loader);
    expect(result.success).toBe(true);
    expect(result.chapterHref).toBe('section3a.xhtml');
  });

  it('returns failure when text is not found anywhere', async () => {
    const loader = makeLoader({
      'chapter1.xhtml': 'completely different content',
      'chapter2.xhtml': 'completely different content',
      'chapter3.xhtml': 'completely different content',
      'section3a.xhtml': 'completely different content',
    });
    const result = await reanchorByText(
      'text that cannot be found anywhere',
      TOC,
      loader,
    );
    expect(result.success).toBe(false);
    expect(result.fallback).toBe(true);
  });

  it('handles chapter load errors gracefully', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('Load failed'));
    const result = await reanchorByText('target text', TOC, loader);
    expect(result.success).toBe(false);
  });

  it('respects a custom fuzzyThreshold', async () => {
    const loader = makeLoader({
      'chapter1.xhtml': 'Optimization is great for performance.',
      'chapter2.xhtml': 'nothing',
      'chapter3.xhtml': 'nothing',
      'section3a.xhtml': 'nothing',
    });
    // With a low threshold (0.5) two matching words out of two should pass.
    const result = await reanchorByText(
      'optimization performance',
      TOC,
      loader,
      { fuzzyThreshold: 0.5 },
    );
    expect(result.success).toBe(true);
    expect(result.matchType).toBe('fuzzy');
  });
});

// ---------------------------------------------------------------------------
// tryReanchor – annotation re-anchoring edge cases
// ---------------------------------------------------------------------------

describe('tryReanchor (pool fallback)', () => {
  it('returns failure immediately for anchors with short selectedText', async () => {
    const anchor = { selectedText: 'hi', cfi: 'epubcfi(/6/4)', chapterRef: 'chapter1.xhtml' };
    const result = await tryReanchor(anchor, TOC, vi.fn());
    expect(result.reanchorResult.success).toBe(false);
    expect(result.reanchorResult.message).toMatch(/too short/i);
    // Original anchor must be preserved
    expect(result.anchor).toEqual(anchor);
  });

  it('updates chapterRef when reanchor succeeds in a different chapter', async () => {
    const anchor = {
      cfi: 'epubcfi(/6/4)',
      selectedText: 'target text in chapter',
      chapterRef: 'chapter1.xhtml',
    };
    const loader = makeLoader({
      'chapter1.xhtml': 'nothing here',
      'chapter2.xhtml': 'Found target text in chapter here.',
      'chapter3.xhtml': 'nothing',
      'section3a.xhtml': 'nothing',
    });
    const result = await tryReanchor(anchor, TOC, loader);
    expect(result.reanchorResult.success).toBe(true);
    expect(result.anchor.chapterRef).toBe('chapter2.xhtml');
  });

  it('preserves original anchor when reanchor fails', async () => {
    const anchor = {
      cfi: 'epubcfi(/6/4)',
      selectedText: 'text that cannot be found anywhere in any chapter',
      chapterRef: 'chapter1.xhtml',
    };
    const loader = makeLoader({
      'chapter1.xhtml': 'different content',
      'chapter2.xhtml': 'different content',
      'chapter3.xhtml': 'different content',
      'section3a.xhtml': 'different content',
    });
    const result = await tryReanchor(anchor, TOC, loader);
    expect(result.reanchorResult.success).toBe(false);
    expect(result.anchor.chapterRef).toBe('chapter1.xhtml');
  });

  it('preserves all original anchor fields on failure', async () => {
    const anchor = {
      cfi: 'epubcfi(/6/8)',
      selectedText: 'text that cannot be found anywhere in any chapter',
      chapterRef: 'chapter2.xhtml',
      highlightColor: 'yellow',
    };
    const loader = vi.fn().mockResolvedValue('completely different');
    const result = await tryReanchor(anchor, TOC, loader);
    expect(result.anchor).toMatchObject({
      cfi: 'epubcfi(/6/8)',
      highlightColor: 'yellow',
    });
  });
});

// ---------------------------------------------------------------------------
// terminateWorker
// ---------------------------------------------------------------------------

describe('terminateWorker', () => {
  it('can be called safely when no pool has been created', () => {
    expect(() => terminateWorker()).not.toThrow();
  });

  it('can be called multiple times without error', () => {
    terminateWorker();
    terminateWorker();
    expect(true).toBe(true);
  });

  it('resets the pool so subsequent calls create a fresh instance', async () => {
    // Warm up the pool
    const loader = makeLoader({ 'chapter1.xhtml': 'target text here' });
    await reanchorByText('target text', TOC, loader);

    // Terminate and verify a new call still works
    terminateWorker();

    const loader2 = makeLoader({ 'chapter1.xhtml': 'target text here' });
    const result = await reanchorByText('target text', TOC, loader2);
    expect(result.success).toBe(true);
  });
});

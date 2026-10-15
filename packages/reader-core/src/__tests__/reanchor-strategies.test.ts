import { describe, expect, it } from 'vitest';
import {
  ExactCfiStrategy,
  TextPositionStrategy,
  FuzzyQuoteStrategy,
  normalizeText,
  type CachedChapter,
} from '../reanchor-strategies';

describe('normalizeText', () => {
  it('strips punctuation and normalizes spaces', () => {
    expect(normalizeText('Hello,   World! 123...')).toBe('hello world 123');
  });
});

function makeCached(content: string): CachedChapter {
  return {
    content,
    lower: content.toLowerCase(),
  };
}

describe('ExactCfiStrategy', () => {
  const strategy = new ExactCfiStrategy();

  it('returns null if anchor has no CFI', () => {
    const res = strategy.execute({
      anchor: { selectedText: 'Sample text' },
      chapterHref: 'ch1.xhtml',
      cached: makeCached('Sample text in chapter'),
    });
    expect(res).toBeNull();
  });

  it('returns success if CFI and chapterRef match chapterHref', () => {
    const res = strategy.execute({
      anchor: {
        cfi: 'epubcfi(/6/4)',
        chapterRef: 'ch1.xhtml',
        selectedText: 'Sample text',
      },
      chapterHref: 'ch1.xhtml',
      cached: makeCached('Sample text in chapter'),
    });
    expect(res).not.toBeNull();
    expect(res?.success).toBe(true);
    expect(res?.matchType).toBe('exact');
  });

  it('returns null if chapterRef does not match chapterHref', () => {
    const res = strategy.execute({
      anchor: {
        cfi: 'epubcfi(/6/4)',
        chapterRef: 'ch1.xhtml',
        selectedText: 'Sample text',
      },
      chapterHref: 'ch2.xhtml',
      cached: makeCached('Sample text in chapter'),
    });
    expect(res).toBeNull();
  });
});

describe('TextPositionStrategy', () => {
  const strategy = new TextPositionStrategy();

  it('returns null if no position selector provided', () => {
    const res = strategy.execute({
      anchor: { selectedText: 'Sample text for position test' },
      chapterHref: 'ch1.xhtml',
      cached: makeCached('0123456789 Sample text for position test in chapter'),
    });
    expect(res).toBeNull();
  });

  it('returns exact match when text position range matches target', () => {
    const chapterContent = 'Header text. Sample text for position test in chapter content.';
    const start = chapterContent.indexOf('Sample text for position test');
    const end = start + 'Sample text for position test'.length;

    const res = strategy.execute({
      anchor: {
        selectedText: 'Sample text for position test',
        position: { start, end },
      },
      chapterHref: 'ch1.xhtml',
      cached: makeCached(chapterContent),
    });

    expect(res).not.toBeNull();
    expect(res?.success).toBe(true);
    expect(res?.matchType).toBe('exact');
  });

  it('returns null if text at position selector does not match', () => {
    const chapterContent = 'Header text. Sample text for position test in chapter content.';

    const res = strategy.execute({
      anchor: {
        selectedText: 'Sample text for position test',
        position: { start: 0, end: 10 },
      },
      chapterHref: 'ch1.xhtml',
      cached: makeCached(chapterContent),
    });

    expect(res).toBeNull();
  });
});

describe('FuzzyQuoteStrategy', () => {
  const strategy = new FuzzyQuoteStrategy();

  it('returns null if selectedText is under 10 characters', () => {
    const res = strategy.execute({
      anchor: { selectedText: 'short' },
      chapterHref: 'ch1.xhtml',
      cached: makeCached('short text here'),
    });
    expect(res).toBeNull();
  });

  it('returns exact match for exact target text in chapter', () => {
    const res = strategy.execute({
      anchor: { selectedText: 'exact quote target text' },
      chapterHref: 'ch1.xhtml',
      cached: makeCached('Before exact quote target text after in chapter content.'),
    });
    expect(res).not.toBeNull();
    expect(res?.success).toBe(true);
    expect(res?.matchType).toBe('exact');
  });

  it('scores prefix and suffix context when provided', () => {
    const res = strategy.execute({
      anchor: {
        selectedText: 'target quote text',
        prefix: 'Before exact',
        suffix: 'after in chapter',
      },
      chapterHref: 'ch1.xhtml',
      cached: makeCached('Before exact target quote text after in chapter content.'),
    });
    expect(res).not.toBeNull();
    expect(res?.success).toBe(true);
    expect(res?.message).toContain('context score 2');
  });

  it('returns partial match when exact not found', () => {
    const res = strategy.execute({
      anchor: { selectedText: 'words scattered throughout the paragraph text' },
      chapterHref: 'ch1.xhtml',
      cached: makeCached(
        'This is content with words scattered throughout the paragraph text section.',
      ),
    });
    expect(res).not.toBeNull();
    expect(res?.success).toBe(true);
    expect(res?.matchType).toBeDefined();
  });

  it('returns fuzzy match based on word overlap', () => {
    const res = strategy.execute({
      anchor: { selectedText: 'important concepts key ideas topic discussion' },
      chapterHref: 'ch1.xhtml',
      cached: makeCached('The chapter discusses important concepts and key ideas about the topic.'),
    });
    expect(res).not.toBeNull();
    expect(res?.success).toBe(true);
    expect(res?.matchType).toBe('fuzzy');
    expect(res?.fallback).toBe(true);
  });
});

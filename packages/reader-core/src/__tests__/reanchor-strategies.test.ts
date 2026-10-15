import { describe, expect, it } from 'vitest';
import {
  TextPositionStrategy,
  ExactAndPartialQuoteStrategy,
  FuzzyWordOverlapStrategy,
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
        chapterRef: 'ch1.xhtml',
        position: { start, end },
      },
      chapterHref: 'ch1.xhtml',
      cached: makeCached(chapterContent),
    });

    expect(res).not.toBeNull();
    expect(res?.success).toBe(true);
    expect(res?.matchType).toBe('exact');
  });
  it('returns the matched text position without reusing the old CFI', () => {
    const chapterContent = 'Header text. Sample text for position test in chapter content.';
    const start = chapterContent.indexOf('Sample text for position test');
    const end = start + 'Sample text for position test'.length;
    const result = strategy.execute({
      anchor: {
        cfi: 'epubcfi(/6/4)',
        selectedText: 'Sample text for position test',
        chapterRef: 'ch1.xhtml#old-section',
        position: { start, end },
      },
      chapterHref: 'ch1.xhtml#new-section',
      cached: makeCached(chapterContent),
    });

    expect(result).toMatchObject({ position: { start, end }, confidence: 0.99 });
    expect(result).not.toHaveProperty('cfi');
  });

  it('returns null if text at position selector does not match', () => {
    const chapterContent = 'Header text. Sample text for position test in chapter content.';

    const res = strategy.execute({
      anchor: {
        selectedText: 'Sample text for position test',
        chapterRef: 'ch1.xhtml',
        position: { start: 0, end: 10 },
      },
      chapterHref: 'ch1.xhtml',
      cached: makeCached(chapterContent),
    });

    expect(res).toBeNull();
  });
});

describe('ExactAndPartialQuoteStrategy', () => {
  const strategy = new ExactAndPartialQuoteStrategy();

  it('rejects quotes shorter than ten characters', () => {
    expect(
      strategy.execute({
        anchor: { selectedText: 'short' },
        chapterHref: 'ch1.xhtml',
        cached: makeCached('short text here'),
      }),
    ).toBeNull();
  });

  it('reanchors an exact quote found once in the chapter', () => {
    const chapterContent = 'Before exact quote target text after in chapter content.';
    const start = chapterContent.indexOf('exact quote target text');
    const result = strategy.execute({
      anchor: { selectedText: 'exact quote target text' },
      chapterHref: 'ch1.xhtml',
      cached: makeCached(chapterContent),
    });

    expect(result).toMatchObject({
      success: true,
      chapterHref: 'ch1.xhtml',
      position: { start, end: start + 'exact quote target text'.length },
      confidence: 0.95,
      matchType: 'exact',
      fallback: false,
    });
  });

  it('uses quote context rather than accepting an ambiguous first occurrence', () => {
    const anchor = {
      selectedText: 'repeated quote passage',
      prefix: 'expected preceding words',
    };
    const ambiguous = strategy.execute({
      anchor,
      chapterHref: 'ch1.xhtml',
      cached: makeCached(
        'unrelated repeated quote passage here; another repeated quote passage appears later',
      ),
    });
    expect(ambiguous).toMatchObject({ success: false, ambiguous: true });

    const contextualContent =
      'unrelated repeated quote passage here; expected preceding words repeated quote passage';
    const contextualStart = contextualContent.lastIndexOf('repeated quote passage');
    const contextual = strategy.execute({
      anchor,
      chapterHref: 'ch1.xhtml',
      cached: makeCached(contextualContent),
    });
    expect(contextual).toMatchObject({
      success: true,
      chapterHref: 'ch1.xhtml',
      position: {
        start: contextualStart,
        end: contextualStart + 'repeated quote passage'.length,
      },
      matchType: 'exact',
    });
  });

  it('rejects repeated quotes when no context selector is available', () => {
    const result = strategy.execute({
      anchor: { selectedText: 'repeated quote passage' },
      chapterHref: 'ch1.xhtml',
      cached: makeCached('repeated quote passage here; repeated quote passage again'),
    });
    expect(result).toMatchObject({ success: false, ambiguous: true });
  });

  it('returns partial when only part of the selected quote survives', () => {
    const result = strategy.execute({
      anchor: {
        selectedText:
          'The selected passage remains a long editorial quote for recovery after a new EPUB revision.',
      },
      chapterHref: 'ch1.xhtml',
      cached: makeCached(
        'The selected passage remains a long editorial quote for recovery after publication in the updated EPUB.',
      ),
    });

    expect(result).toMatchObject({
      success: true,
      chapterHref: 'ch1.xhtml',
      confidence: 0.65,
      matchType: 'partial',
      fallback: true,
    });
    expect(result).not.toHaveProperty('position');
  });
});

describe('FuzzyWordOverlapStrategy', () => {
  const strategy = new FuzzyWordOverlapStrategy();

  it('rejects quotes shorter than ten characters', () => {
    expect(
      strategy.execute({
        anchor: { selectedText: 'short' },
        chapterHref: 'ch1.xhtml',
        cached: makeCached('short text here'),
      }),
    ).toBeNull();
  });

  it('matches when enough distinct quote words remain in the chapter', () => {
    const result = strategy.execute({
      anchor: { selectedText: 'important concepts key ideas topic discussion' },
      chapterHref: 'ch1.xhtml',
      cached: makeCached('The chapter discusses important concepts and key ideas about the topic.'),
    });

    expect(result).toMatchObject({
      success: true,
      chapterHref: 'ch1.xhtml',
      confidence: 0.35,
      matchType: 'fuzzy',
      fallback: true,
    });
    expect(result).not.toHaveProperty('position');
  });

  it('rejects a quote when the chapter has insufficient word overlap', () => {
    const result = strategy.execute({
      anchor: { selectedText: 'important concepts key ideas topic discussion' },
      chapterHref: 'ch1.xhtml',
      cached: makeCached('This unrelated section discusses several different subjects in detail.'),
    });

    expect(result).toBeNull();
  });
});

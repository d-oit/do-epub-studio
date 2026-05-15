import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createLocator,
  parseLocator,
  locatorToString,
  extractTextFromRange,
} from '../locator';
import { isValidCfi } from '../epub-loader';

describe('createLocator', () => {
  it('creates a locator with all required fields', () => {
    const locator = createLocator('epubcfi(/6/4)', 'Selected text', 'chapter1.xhtml');
    expect(locator.cfi).toBe('epubcfi(/6/4)');
    expect(locator.textExcerpt).toBe('Selected text');
    expect(locator.chapterHref).toBe('chapter1.xhtml');
  });

  it('handles empty text', () => {
    const locator = createLocator('epubcfi(/6/4)', '', 'chapter1.xhtml');
    expect(locator.textExcerpt).toBe('');
  });

  it('handles complex CFI', () => {
    const complexCfi = 'epubcfi(/6/12!/4/2[p001]/2/1:0)';
    const locator = createLocator(complexCfi, 'Text', 'chap.xhtml');
    expect(locator.cfi).toBe(complexCfi);
  });
});

describe('parseLocator', () => {
  it('parses a valid locator string', () => {
    const locatorString = JSON.stringify({
      cfi: 'epubcfi(/6/4)',
      textExcerpt: 'Selected text',
      chapterHref: 'chapter1.xhtml',
    });
    const result = parseLocator(locatorString);
    expect(result).not.toBeNull();
    expect(result?.cfi).toBe('epubcfi(/6/4)');
    expect(result?.textExcerpt).toBe('Selected text');
    expect(result?.chapterHref).toBe('chapter1.xhtml');
  });

  it('returns null for invalid JSON', () => {
    const result = parseLocator('not json');
    expect(result).toBeNull();
  });

  it('returns null for missing cfi', () => {
    const locatorString = JSON.stringify({
      textExcerpt: 'Text',
      chapterHref: 'chapter1.xhtml',
    });
    const result = parseLocator(locatorString);
    expect(result).toBeNull();
  });

  it('returns null for missing textExcerpt', () => {
    const locatorString = JSON.stringify({
      cfi: 'epubcfi(/6/4)',
      chapterHref: 'chapter1.xhtml',
    });
    const result = parseLocator(locatorString);
    expect(result).toBeNull();
  });

  it('returns null for missing chapterHref', () => {
    const locatorString = JSON.stringify({
      cfi: 'epubcfi(/6/4)',
      textExcerpt: 'Text',
    });
    const result = parseLocator(locatorString);
    expect(result).toBeNull();
  });

  it('returns null for non-string fields', () => {
    const locatorString = JSON.stringify({
      cfi: 123,
      textExcerpt: 'Text',
      chapterHref: 'chapter1.xhtml',
    });
    const result = parseLocator(locatorString);
    expect(result).toBeNull();
  });
});

describe('locatorToString', () => {
  it('serializes locator to JSON string', () => {
    const locator = createLocator('epubcfi(/6/4)', 'Text', 'chapter1.xhtml');
    const string = locatorToString(locator);
    expect(string).toBe(JSON.stringify(locator));
  });

  it('produces parseable output', () => {
    const locator = createLocator('epubcfi(/6/4)', 'Text', 'chapter1.xhtml');
    const string = locatorToString(locator);
    const parsed = parseLocator(string);
    expect(parsed).toEqual(locator);
  });
});

describe('extractTextFromRange', () => {
  it('extracts text from a mock range', () => {
    // Create a mock Range object
    const mockRange = {
      toString: () => 'Selected text from range',
    } as unknown as Range;
    const result = extractTextFromRange(mockRange);
    expect(result).toBe('Selected text from range');
  });

  it('trims whitespace', () => {
    const mockRange = {
      toString: () => '  Selected text  ',
    } as unknown as Range;
    const result = extractTextFromRange(mockRange);
    expect(result).toBe('Selected text');
  });

  it('collapses multiple spaces', () => {
    const mockRange = {
      toString: () => 'Selected   text    here',
    } as unknown as Range;
    const result = extractTextFromRange(mockRange);
    expect(result).toBe('Selected text here');
  });

  it('truncates long text with default maxLength', () => {
    const longText = 'A'.repeat(200);
    const mockRange = {
      toString: () => longText,
    } as unknown as Range;
    const result = extractTextFromRange(mockRange);
    expect(result.length).toBe(150);
    expect(result.endsWith('...')).toBe(true);
  });

  it('respects custom maxLength', () => {
    const longText = 'A'.repeat(100);
    const mockRange = {
      toString: () => longText,
    } as unknown as Range;
    const result = extractTextFromRange(mockRange, 50);
    expect(result.length).toBe(50);
    expect(result.endsWith('...')).toBe(true);
  });

  it('does not truncate short text', () => {
    const shortText = 'Short text';
    const mockRange = {
      toString: () => shortText,
    } as unknown as Range;
    const result = extractTextFromRange(mockRange, 100);
    expect(result).toBe(shortText);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('isValidCfi (property)', () => {
  it('never throws for any string input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(() => isValidCfi(input)).not.toThrow();
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// CFI creation edge cases
// ---------------------------------------------------------------------------

describe('createLocator - CFI variants', () => {
  it('accepts CFI with temporal offset /4/2/1:50', () => {
    const locator = createLocator('epubcfi(/4/2/1:50)', 'text', 'ch.xhtml');
    expect(locator.cfi).toBe('epubcfi(/4/2/1:50)');
  });

  it('accepts CFI with spatial offset /4/2/10:50', () => {
    const locator = createLocator('epubcfi(/4/2/10:50)', 'text', 'ch.xhtml');
    expect(locator.cfi).toBe('epubcfi(/4/2/10:50)');
  });

  it('accepts CFI with sub-path /4/2/10!/4/6/1:0', () => {
    const locator = createLocator('epubcfi(/4/2/10!/4/6/1:0)', 'text', 'ch.xhtml');
    expect(locator.cfi).toBe('epubcfi(/4/2/10!/4/6/1:0)');
  });

  it('accepts CFI with fragment identifier', () => {
    const locator = createLocator('epubcfi(/4/2[chapter])', 'text', 'ch.xhtml');
    expect(locator.cfi).toBe('epubcfi(/4/2[chapter])');
  });

  it('accepts CFI with long step sequence', () => {
    const cfi = 'epubcfi(/6/12/4/2/8/3/10/1)';
    const locator = createLocator(cfi, 'text', 'ch.xhtml');
    expect(locator.cfi).toBe(cfi);
  });

  it('accepts CFI combining sub-path and fragment', () => {
    const cfi = 'epubcfi(/6/12!/4/2[p001]/2/1:0)';
    const locator = createLocator(cfi, 'text', 'ch.xhtml');
    expect(locator.cfi).toBe(cfi);
  });

  it('handles chapter href with path separators', () => {
    const locator = createLocator('epubcfi(/6/4)', 'text', 'OEBPS/chapter1.xhtml');
    expect(locator.chapterHref).toBe('OEBPS/chapter1.xhtml');
  });

  it('handles text with unicode characters', () => {
    const locator = createLocator('epubcfi(/6/4)', 'café résumé 日本語', 'ch.xhtml');
    expect(locator.textExcerpt).toBe('café résumé 日本語');
  });

  it('handles text with XML special characters', () => {
    const text = 'Text with "quotes" and <brackets> & ampersands';
    const locator = createLocator('epubcfi(/6/4)', text, 'ch.xhtml');
    expect(locator.textExcerpt).toBe(text);
  });

  it('handles CFI with trailing temporal offsets', () => {
    const locator = createLocator('epubcfi(/6/4/1:0/2:30)', 'text', 'ch.xhtml');
    expect(locator.cfi).toBe('epubcfi(/6/4/1:0/2:30)');
  });
});

// ---------------------------------------------------------------------------
// CFI parsing edge cases
// ---------------------------------------------------------------------------

describe('parseLocator - edge cases', () => {
  it('returns null for empty string', () => {
    expect(parseLocator('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseLocator('   ')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseLocator('{cfi: "epubcfi(/6/4)"}')).toBeNull();
  });

  it('returns null for null JSON', () => {
    expect(parseLocator('null')).toBeNull();
  });

  it('returns null for array JSON', () => {
    expect(parseLocator('["epubcfi(/6/4)", "text", "ch.xhtml"]')).toBeNull();
  });

  it('returns null for JSON with wrong field names', () => {
    const loc = JSON.stringify({ cfi: 'epubcfi(/6/4)', excerpt: 'text', href: 'ch.xhtml' });
    expect(parseLocator(loc)).toBeNull();
  });

  it('accepts extra fields beyond required', () => {
    const loc = JSON.stringify({
      cfi: 'epubcfi(/6/4)',
      textExcerpt: 'text',
      chapterHref: 'ch.xhtml',
      extra: 'field',
    });
    const result = parseLocator(loc);
    expect(result).not.toBeNull();
    expect(result!.cfi).toBe('epubcfi(/6/4)');
  });

  it('parses locator with very long CFI string', () => {
    const longCfi = 'epubcfi(/6/' + Array(100).fill('1/2/3').join('/') + ')';
    const loc = JSON.stringify({ cfi: longCfi, textExcerpt: 'text', chapterHref: 'ch.xhtml' });
    const result = parseLocator(loc);
    expect(result).not.toBeNull();
    expect(result!.cfi.length).toBeGreaterThan(500);
  });

  it('parses locator with empty textExcerpt', () => {
    const loc = JSON.stringify({ cfi: 'epubcfi(/6/4)', textExcerpt: '', chapterHref: 'ch.xhtml' });
    const result = parseLocator(loc);
    expect(result).not.toBeNull();
    expect(result!.textExcerpt).toBe('');
  });

  it('parses locator with empty chapterHref', () => {
    const loc = JSON.stringify({ cfi: 'epubcfi(/6/4)', textExcerpt: 'text', chapterHref: '' });
    const result = parseLocator(loc);
    expect(result).not.toBeNull();
    expect(result!.chapterHref).toBe('');
  });

  it('returns null for numeric cfi', () => {
    const loc = JSON.stringify({ cfi: 42, textExcerpt: 'text', chapterHref: 'ch.xhtml' });
    expect(parseLocator(loc)).toBeNull();
  });

  it('returns null for null cfi', () => {
    const loc = JSON.stringify({ cfi: null, textExcerpt: 'text', chapterHref: 'ch.xhtml' });
    expect(parseLocator(loc)).toBeNull();
  });

  it('returns null for object cfi', () => {
    const loc = JSON.stringify({ cfi: {}, textExcerpt: 'text', chapterHref: 'ch.xhtml' });
    expect(parseLocator(loc)).toBeNull();
  });

  it('returns null for boolean textExcerpt', () => {
    const loc = JSON.stringify({ cfi: 'epubcfi(/6/4)', textExcerpt: true, chapterHref: 'ch.xhtml' });
    expect(parseLocator(loc)).toBeNull();
  });

  it('returns null for numeric chapterHref', () => {
    const loc = JSON.stringify({ cfi: 'epubcfi(/6/4)', textExcerpt: 'text', chapterHref: 123 });
    expect(parseLocator(loc)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CFI navigation and comparison
// ---------------------------------------------------------------------------

describe('CFI navigation and comparison', () => {
  function parseCfiSteps(cfi: string): number[] {
    const match = cfi.match(/^epubcfi\((.+)\)$/);
    if (!match) return [];
    const inner = match[1]!;
    return inner
      .split('/')
      .filter(Boolean)
      .map((s) => {
        const num = parseInt(s, 10);
        return isNaN(num) ? -1 : num;
      });
  }

  function parentCfi(cfi: string): string | null {
    const steps = parseCfiSteps(cfi);
    if (steps.length <= 1) return null;
    const parentInner = steps.slice(0, -1).join('/');
    return `epubcfi(/${parentInner})`;
  }

  function compareCfi(a: string, b: string): number {
    const stepsA = parseCfiSteps(a);
    const stepsB = parseCfiSteps(b);
    const minLen = Math.min(stepsA.length, stepsB.length);
    for (let i = 0; i < minLen; i++) {
      if (stepsA[i]! < stepsB[i]!) return -1;
      if (stepsA[i]! > stepsB[i]!) return 1;
    }
    if (stepsA.length < stepsB.length) return -1;
    if (stepsA.length > stepsB.length) return 1;
    return 0;
  }

  it('extracts step indices from CFI path', () => {
    const steps = parseCfiSteps('epubcfi(/6/4/2/10)');
    expect(steps).toEqual([6, 4, 2, 10]);
  });

  it('returns empty array for minimal CFI', () => {
    expect(parseCfiSteps('epubcfi()')).toEqual([]);
  });

  it('computes parent CFI for multi-step path', () => {
    expect(parentCfi('epubcfi(/6/4/2)')).toBe('epubcfi(/6/4)');
  });

  it('returns null parent for single-step CFI', () => {
    expect(parentCfi('epubcfi(/6)')).toBeNull();
  });

  it('computes parent CFI from CFI with temporal offset', () => {
    expect(parentCfi('epubcfi(/6/4/2/1:50)')).toBe('epubcfi(/6/4/2)');
  });

  it('compares equal CFIs as 0', () => {
    expect(compareCfi('epubcfi(/6/4)', 'epubcfi(/6/4)')).toBe(0);
  });

  it('compares shallower path as earlier', () => {
    expect(compareCfi('epubcfi(/6/4)', 'epubcfi(/6/4/2)')).toBe(-1);
    expect(compareCfi('epubcfi(/6/4/2)', 'epubcfi(/6/4)')).toBe(1);
  });

  it('compares same-depth different steps', () => {
    expect(compareCfi('epubcfi(/6/4)', 'epubcfi(/6/10)')).toBe(-1);
    expect(compareCfi('epubcfi(/6/10)', 'epubcfi(/6/4)')).toBe(1);
  });

  it('compares CFIs with different first step', () => {
    expect(compareCfi('epubcfi(/4/2)', 'epubcfi(/6/4)')).toBe(-1);
    expect(compareCfi('epubcfi(/6/4)', 'epubcfi(/4/2)')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Multi-signal locator integration
// ---------------------------------------------------------------------------

describe('multi-signal locator', () => {
  it('creates locator with all signals populated', () => {
    const locator = createLocator('epubcfi(/6/4)', 'annotation text', 'chapter1.xhtml');
    expect(locator).toEqual({
      cfi: 'epubcfi(/6/4)',
      textExcerpt: 'annotation text',
      chapterHref: 'chapter1.xhtml',
    });
  });

  it('creates locator with minimal single-char text', () => {
    const locator = createLocator('epubcfi(/6/4)', 'x', 'ch.xhtml');
    expect(locator.textExcerpt).toBe('x');
  });

  it('creates locator with long text excerpt (1000 chars)', () => {
    const longText = 'A'.repeat(1000);
    const locator = createLocator('epubcfi(/6/4)', longText, 'ch.xhtml');
    expect(locator.textExcerpt).toBe(longText);
  });

  it('creates locator with chapter ref containing query params', () => {
    const locator = createLocator('epubcfi(/6/4)', 'text', 'chapter.xhtml?page=5');
    expect(locator.chapterHref).toBe('chapter.xhtml?page=5');
  });

  it('creates locator with chapter ref containing hash fragment', () => {
    const locator = createLocator('epubcfi(/6/4)', 'text', 'chapter.xhtml#section2');
    expect(locator.chapterHref).toBe('chapter.xhtml#section2');
  });

  it('round-trips CFI with sub-path through serialization', () => {
    const original = createLocator('epubcfi(/6/12!/4/2[p001]/2/1:0)', 'text', 'ch.xhtml');
    const parsed = parseLocator(locatorToString(original));
    expect(parsed).toEqual(original);
  });

  it('preserves empty text through round-trip', () => {
    const original = createLocator('epubcfi(/6/4)', '', 'ch.xhtml');
    const parsed = parseLocator(locatorToString(original));
    expect(parsed).toEqual(original);
  });

  it('preserves multiple chapter refs through independent round-trips', () => {
    const locators = [
      createLocator('epubcfi(/6/4)', 'text1', 'chapter1.xhtml'),
      createLocator('epubcfi(/6/10)', 'text2', 'chapter2.xhtml'),
      createLocator('epubcfi(/6/20)', 'text3', 'chapter3.xhtml'),
    ];
    for (const loc of locators) {
      const parsed = parseLocator(locatorToString(loc));
      expect(parsed).toEqual(loc);
    }
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('round-trip createLocator', () => {
  it('preserves CFI through create -> stringify -> parse', () => {
    const original = createLocator('epubcfi(/6/4/2)', 'selected text', 'chapter.xhtml');
    const parsed = parseLocator(locatorToString(original));
    expect(parsed).not.toBeNull();
    expect(parsed!.cfi).toBe('epubcfi(/6/4/2)');
    expect(parsed!.textExcerpt).toBe('selected text');
    expect(parsed!.chapterHref).toBe('chapter.xhtml');
  });

  it('preserves CFI with temporal offset through round-trip', () => {
    const original = createLocator('epubcfi(/6/4/1:50)', 'text', 'ch.xhtml');
    const parsed = parseLocator(locatorToString(original));
    expect(parsed!.cfi).toBe('epubcfi(/6/4/1:50)');
  });

  it('preserves CFI with sub-path through round-trip', () => {
    const original = createLocator('epubcfi(/6/12!/4/2/1:0)', 'text', 'ch.xhtml');
    const parsed = parseLocator(locatorToString(original));
    expect(parsed!.cfi).toBe('epubcfi(/6/12!/4/2/1:0)');
  });

  it('preserves CFI with fragment through round-trip', () => {
    const original = createLocator('epubcfi(/6/4[chap1])', 'text', 'ch.xhtml');
    const parsed = parseLocator(locatorToString(original));
    expect(parsed!.cfi).toBe('epubcfi(/6/4[chap1])');
  });

  it('handles multiple independent round-trips', () => {
    const locs = [
      createLocator('epubcfi(/6/4)', 'text a', 'chap1.xhtml'),
      createLocator('epubcfi(/6/10)', 'text b', 'chap2.xhtml'),
      createLocator('epubcfi(/6/20/1:0)', 'text c', 'chap3.xhtml'),
    ];
    const results = locs.map((l) => parseLocator(locatorToString(l)));
    expect(results[0]!.chapterHref).toBe('chap1.xhtml');
    expect(results[1]!.chapterHref).toBe('chap2.xhtml');
    expect(results[2]!.chapterHref).toBe('chap3.xhtml');
  });
});

// ---------------------------------------------------------------------------
// Property-based tests (expanded)
// ---------------------------------------------------------------------------

describe('property-based tests', () => {
  it('createLocator preserves any string inputs exactly', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (cfi, text, chapter) => {
        const loc = createLocator(cfi, text, chapter);
        expect(loc.cfi).toBe(cfi);
        expect(loc.textExcerpt).toBe(text);
        expect(loc.chapterHref).toBe(chapter);
      }),
    );
  });

  it('parseLocator round-trips valid locators', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string({ minLength: 1 }),
        (cfi, text, chapter) => {
          const loc = createLocator(cfi, text, chapter);
          const parsed = parseLocator(locatorToString(loc));
          expect(parsed).toEqual(loc);
        },
      ),
    );
  });

  it('locatorToString always produces parseable output', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        (cfi, text, chapter) => {
          const loc = createLocator(cfi, text, chapter);
          const str = locatorToString(loc);
          const parsed = parseLocator(str);
          expect(parsed).toEqual(loc);
        },
      ),
    );
  });
});
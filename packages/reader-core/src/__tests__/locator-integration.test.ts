import { describe, expect, it } from 'vitest';
import { createLocator, parseLocator, locatorToString, type LocatorResult } from '../locator';

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

describe('round-trip createLocator', () => {
  it('preserves CFI through create -> stringify -> parse', () => {
    const original = createLocator('epubcfi(/6/4/2)', 'selected text', 'chapter.xhtml');
    const parsed = parseLocator(locatorToString(original));
    expect(parsed).not.toBeNull();
    expect((parsed as LocatorResult).cfi).toBe('epubcfi(/6/4/2)');
    expect((parsed as LocatorResult).textExcerpt).toBe('selected text');
    expect((parsed as LocatorResult).chapterHref).toBe('chapter.xhtml');
  });

  it('preserves CFI with temporal offset through round-trip', () => {
    const original = createLocator('epubcfi(/6/4/1:50)', 'text', 'ch.xhtml');
    const parsed = parseLocator(locatorToString(original));
    expect((parsed as LocatorResult).cfi).toBe('epubcfi(/6/4/1:50)');
  });

  it('preserves CFI with sub-path through round-trip', () => {
    const original = createLocator('epubcfi(/6/12!/4/2/1:0)', 'text', 'ch.xhtml');
    const parsed = parseLocator(locatorToString(original));
    expect((parsed as LocatorResult).cfi).toBe('epubcfi(/6/12!/4/2/1:0)');
  });

  it('preserves CFI with fragment through round-trip', () => {
    const original = createLocator('epubcfi(/6/4[chap1])', 'text', 'ch.xhtml');
    const parsed = parseLocator(locatorToString(original));
    expect((parsed as LocatorResult).cfi).toBe('epubcfi(/6/4[chap1])');
  });

  it('handles multiple independent round-trips', () => {
    const locs = [
      createLocator('epubcfi(/6/4)', 'text a', 'chap1.xhtml'),
      createLocator('epubcfi(/6/10)', 'text b', 'chap2.xhtml'),
      createLocator('epubcfi(/6/20/1:0)', 'text c', 'chap3.xhtml'),
    ];
    const results = locs.map((l) => parseLocator(locatorToString(l)));
    expect((results[0] as LocatorResult).chapterHref).toBe('chap1.xhtml');
    expect((results[1] as LocatorResult).chapterHref).toBe('chap2.xhtml');
    expect((results[2] as LocatorResult).chapterHref).toBe('chap3.xhtml');
  });
});

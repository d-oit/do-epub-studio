import { describe, expect, it } from 'vitest';
import { createLocator, parseLocator, type LocatorResult } from '../locator';

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
    expect((result as LocatorResult).cfi).toBe('epubcfi(/6/4)');
  });
  it('parses locator with very long CFI string', () => {
    const longCfi = 'epubcfi(/6/' + Array(100).fill('1/2/3').join('/') + ')';
    const loc = JSON.stringify({ cfi: longCfi, textExcerpt: 'text', chapterHref: 'ch.xhtml' });
    const result = parseLocator(loc);
    expect(result).not.toBeNull();
    expect((result as LocatorResult).cfi.length).toBeGreaterThan(500);
  });
  it('parses locator with empty textExcerpt', () => {
    const loc = JSON.stringify({ cfi: 'epubcfi(/6/4)', textExcerpt: '', chapterHref: 'ch.xhtml' });
    const result = parseLocator(loc);
    expect(result).not.toBeNull();
    expect((result as LocatorResult).textExcerpt).toBe('');
  });
  it('parses locator with empty chapterHref', () => {
    const loc = JSON.stringify({ cfi: 'epubcfi(/6/4)', textExcerpt: 'text', chapterHref: '' });
    const result = parseLocator(loc);
    expect(result).not.toBeNull();
    expect((result as LocatorResult).chapterHref).toBe('');
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

describe('CFI navigation and comparison', () => {
  function parseCfiSteps(cfi: string): number[] {
    const match = cfi.match(/^epubcfi\((.+)\)$/);
    if (!match) return [];
    const inner = match[1];
    if (!inner) return [];
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
      const stepA = stepsA[i] as number;
      const stepB = stepsB[i] as number;
      if (stepA < stepB) return -1;
      if (stepA > stepB) return 1;
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

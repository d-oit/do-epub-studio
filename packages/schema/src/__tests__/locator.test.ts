import { describe, it, expect } from 'vitest';
import { createLocator, locatorToJson, locatorFromJson, hasCfi, hasSelectedText, isValidLocator, extractTextExcerpt, cfiToRange, rangeToCfi } from '../locator';

describe('createLocator', () => {
  it('creates locator with cfi', () => {
    const locator = createLocator({ cfi: 'epubcfi(/6/4)' });
    expect(locator.cfi).toBe('epubcfi(/6/4)');
    expect(locator.selectedText).toBeUndefined();
  });

  it('creates locator with selectedText', () => {
    const locator = createLocator({ selectedText: 'some text here' });
    expect(locator.selectedText).toBe('some text here');
  });

  it('creates empty locator from empty params', () => {
    const locator = createLocator({});
    expect(locator.cfi).toBeUndefined();
    expect(locator.selectedText).toBeUndefined();
    expect(locator.chapterRef).toBeUndefined();
  });

  it('creates locator with all fields', () => {
    const locator = createLocator({ cfi: 'epubcfi(/6/4)', selectedText: 'text', chapterRef: 'chap1', elementIndex: 2, charOffset: 10 });
    expect(locator.cfi).toBe('epubcfi(/6/4)');
    expect(locator.selectedText).toBe('text');
    expect(locator.chapterRef).toBe('chap1');
    expect(locator.elementIndex).toBe(2);
    expect(locator.charOffset).toBe(10);
  });
});

describe('locatorToJson / locatorFromJson', () => {
  it('round-trips a locator', () => {
    const original = createLocator({ cfi: 'epubcfi(/6/4)', selectedText: 'hello' });
    const json = locatorToJson(original);
    const restored = locatorFromJson(json);
    expect(restored.cfi).toBe('epubcfi(/6/4)');
    expect(restored.selectedText).toBe('hello');
  });

  it('produces valid JSON', () => {
    const locator = createLocator({ cfi: 'epubcfi(/6/4)' });
    const json = locatorToJson(locator);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('hasCfi', () => {
  it('returns true for non-empty cfi', () => {
    expect(hasCfi(createLocator({ cfi: 'epubcfi(/6/4)' }))).toBe(true);
  });

  it('returns false for empty string cfi', () => {
    expect(hasCfi(createLocator({ cfi: '' }))).toBe(false);
  });

  it('returns false when cfi is undefined', () => {
    expect(hasCfi(createLocator({}))).toBe(false);
  });
});

describe('hasSelectedText', () => {
  it('returns true for text >= 10 chars', () => {
    expect(hasSelectedText(createLocator({ selectedText: '1234567890' }))).toBe(true);
    expect(hasSelectedText(createLocator({ selectedText: '12345678901' }))).toBe(true);
  });

  it('returns false for text < 10 chars', () => {
    expect(hasSelectedText(createLocator({ selectedText: '123456789' }))).toBe(false);
  });

  it('returns false when selectedText is undefined', () => {
    expect(hasSelectedText(createLocator({}))).toBe(false);
  });
});

describe('isValidLocator', () => {
  it('returns true if has cfi', () => {
    expect(isValidLocator(createLocator({ cfi: 'epubcfi(/6/4)' }))).toBe(true);
  });

  it('returns true if has long selectedText', () => {
    expect(isValidLocator(createLocator({ selectedText: '1234567890' }))).toBe(true);
  });

  it('returns false if neither cfi nor long text', () => {
    expect(isValidLocator(createLocator({}))).toBe(false);
  });
});

describe('extractTextExcerpt', () => {
  it('returns text unchanged if under maxLength', () => {
    expect(extractTextExcerpt('hello')).toBe('hello');
  });

  it('truncates and adds ellipsis', () => {
    const long = 'a'.repeat(200);
    const result = extractTextExcerpt(long, 100);
    expect(result.length).toBe(100);
    expect(result.endsWith('...')).toBe(true);
  });

  it('trims whitespace and collapses spaces', () => {
    expect(extractTextExcerpt('  hello   world  ')).toBe('hello world');
  });
});

describe('cfiToRange', () => {
  it('parses simple cfi', () => {
    const result = cfiToRange('epubcfi(/6)');
    expect(result).not.toBeNull();
    expect((result as NonNullable<typeof result>).spineIndex).toBe(6);
    expect((result as NonNullable<typeof result>).charOffset).toBe(0);
  });

  it('parses cfi with char offset', () => {
    const result = cfiToRange('epubcfi(/6:100)');
    expect(result).not.toBeNull();
    expect((result as NonNullable<typeof result>).spineIndex).toBe(6);
    expect((result as NonNullable<typeof result>).charOffset).toBe(100);
  });

  it('returns null for invalid cfi', () => {
    expect(cfiToRange('')).toBeNull();
    expect(cfiToRange('invalid')).toBeNull();
  });
});

describe('rangeToCfi', () => {
  it('builds cfi without char offset', () => {
    expect(rangeToCfi(6, '')).toBe('epubcfi(/6)');
  });

  it('builds cfi with char offset', () => {
    expect(rangeToCfi(6, '', 100)).toBe('epubcfi(/6:100)');
  });
});

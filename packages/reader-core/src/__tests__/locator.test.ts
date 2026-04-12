import { describe, expect, it } from 'vitest';
import {
  createLocator,
  parseLocator,
  locatorToString,
  extractTextFromRange,
} from '../locator';

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
import { describe, expect, it } from 'vitest';
import {
  MultiSignalLocatorSchema,
  ProgressUpdateSchema,
} from '../schemas';

describe('MultiSignalLocatorSchema', () => {
  it('accepts valid multi-signal locator with all fields', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4[chapter1]!/4/2/1:0)',
      selectedText: 'important passage',
      chapterRef: 'chapter1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects locator with empty cfi string', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: '',
      selectedText: 'text',
      chapterRef: 'ch1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('CFI is required');
    }
  });

  it('rejects locator with empty selectedText', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4)',
      selectedText: '',
      chapterRef: 'ch1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Selected text is required');
    }
  });

  it('rejects locator with empty chapterRef', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4)',
      selectedText: 'text',
      chapterRef: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Chapter reference is required');
    }
  });

  it('rejects locator missing cfi field entirely', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      selectedText: 'text',
      chapterRef: 'ch1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects locator missing selectedText field entirely', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4)',
      chapterRef: 'ch1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects locator missing chapterRef field entirely', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4)',
      selectedText: 'text',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty object', () => {
    const result = MultiSignalLocatorSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects extra fields via strict()', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4)',
      selectedText: 'text',
      chapterRef: 'ch1',
      extraField: 'should-not-exist',
    });
    expect(result.success).toBe(false);
  });
});

describe('ProgressUpdateSchema', () => {
  it('accepts valid progress with multi-signal locator', () => {
    const result = ProgressUpdateSchema.safeParse({
      locator: { cfi: 'epubcfi(/6/4)', selectedText: 'text', chapterRef: 'ch1' },
      progressPercent: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects progress with incomplete locator', () => {
    const result = ProgressUpdateSchema.safeParse({
      locator: { cfi: 'epubcfi(/6/4)' },
      progressPercent: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects progressPercent below 0', () => {
    const result = ProgressUpdateSchema.safeParse({
      locator: { cfi: 'epubcfi(/6/4)', selectedText: 'text', chapterRef: 'ch1' },
      progressPercent: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects progressPercent above 100', () => {
    const result = ProgressUpdateSchema.safeParse({
      locator: { cfi: 'epubcfi(/6/4)', selectedText: 'text', chapterRef: 'ch1' },
      progressPercent: 101,
    });
    expect(result.success).toBe(false);
  });
});

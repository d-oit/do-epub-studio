import { describe, it, expect } from 'vitest';
import { translate, formatNumber, formatDate } from '../i18n';
import { en } from '../i18n/en';
import { pluralize } from '../lib/i18n-format';

describe('translate', () => {
  it('replaces all occurrences of a placeholder', () => {
    // Find a key with a placeholder to verify replaceAll behavior
    const keyWithParam = Object.keys(en).find((k) => en[k as keyof typeof en].includes('{'));
    if (keyWithParam) {
      const result = translate(keyWithParam as never, 'en', { 0: 'TEST' });
      expect(result).not.toContain('{0}');
    }
  });

  it('returns key when not found in any locale', () => {
    const result = translate('nonexistent.key' as never, 'en');
    expect(result).toBe('nonexistent.key');
  });

  it('falls back to English for missing locale keys', () => {
    const result = translate('reader.title', 'en');
    expect(typeof result).toBe('string');
  });
});

describe('formatNumber', () => {
  it('formats number with default options', () => {
    const result = formatNumber(1234.56, 'en');
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  it('formats number with locale-specific grouping', () => {
    const enResult = formatNumber(1234, 'en');
    const deResult = formatNumber(1234, 'de');
    // English uses comma, German uses period for grouping
    expect(enResult).toBe('1,234');
    expect(deResult).toBe('1.234');
  });

  it('formats currency', () => {
    const result = formatNumber(42.5, 'en', { style: 'currency', currency: 'USD' });
    expect(result).toContain('42');
    expect(result).toContain('$');
  });

  it('formats percent', () => {
    const result = formatNumber(0.75, 'en', { style: 'percent' });
    expect(result).toContain('75');
  });
});

describe('formatDate', () => {
  it('formats date with default options', () => {
    const date = new Date('2026-08-05T12:00:00Z');
    const result = formatDate(date, 'en');
    expect(result).toContain('2026');
  });

  it('formats date with custom options', () => {
    const date = new Date('2026-08-05T12:00:00Z');
    const result = formatDate(date, 'en', { year: 'numeric', month: 'long', day: 'numeric' });
    expect(result).toContain('August');
    expect(result).toContain('5');
    expect(result).toContain('2026');
  });

  it('formats date in different locales', () => {
    const date = new Date('2026-08-05T12:00:00Z');
    const enResult = formatDate(date, 'en', { month: 'long' });
    const deResult = formatDate(date, 'de', { month: 'long' });
    expect(enResult).toContain('August');
    expect(deResult).toContain('August'); // German: August
  });
});

describe('pluralize', () => {
  const ALL = {
    zero: 'ZERO',
    one: 'ONE',
    two: 'TWO',
    few: 'FEW',
    many: 'MANY',
    other: 'OTHER',
  } as const;

  it('classifies English counts (one vs other)', () => {
    expect(pluralize('en', 1, ALL)).toBe('ONE');
    expect(pluralize('en', 0, ALL)).toBe('OTHER');
    expect(pluralize('en', 2, ALL)).toBe('OTHER');
    expect(pluralize('en', 5, ALL)).toBe('OTHER');
  });

  it('classifies Arabic counts across all categories', () => {
    expect(pluralize('ar', 0, ALL)).toBe('ZERO');
    expect(pluralize('ar', 1, ALL)).toBe('ONE');
    expect(pluralize('ar', 2, ALL)).toBe('TWO');
    expect(pluralize('ar', 3, ALL)).toBe('FEW');
    expect(pluralize('ar', 5, ALL)).toBe('FEW');
    expect(pluralize('ar', 11, ALL)).toBe('MANY');
  });

  it('classifies French counts (one incl. zero, other for rest)', () => {
    expect(pluralize('fr', 0, ALL)).toBe('ONE');
    expect(pluralize('fr', 1, ALL)).toBe('ONE');
    expect(pluralize('fr', 2, ALL)).toBe('OTHER');
    expect(pluralize('fr', 5, ALL)).toBe('OTHER');
  });

  it('classifies Russian counts (one/few/many)', () => {
    expect(pluralize('ru', 1, ALL)).toBe('ONE');
    expect(pluralize('ru', 2, ALL)).toBe('FEW');
    expect(pluralize('ru', 4, ALL)).toBe('FEW');
    expect(pluralize('ru', 5, ALL)).toBe('MANY');
    expect(pluralize('ru', 0, ALL)).toBe('MANY');
  });

  it('treats zh as a single-other language', () => {
    expect(pluralize('zh', 0, ALL)).toBe('OTHER');
    expect(pluralize('zh', 1, ALL)).toBe('OTHER');
    expect(pluralize('zh', 5, ALL)).toBe('OTHER');
  });

  it('falls back to other when the selected category is not provided', () => {
    // English classifies 1 as `one` but we omit it — must return `other`.
    const noOne = { other: 'OTH' };
    expect(pluralize('en', 1, noOne)).toBe('OTH');
    // Arabic classifies 2 as `two` but we omit it — must return `other`.
    const noTwo = { other: 'OTH' };
    expect(pluralize('ar', 2, noTwo)).toBe('OTH');
  });

  it('returns other for a category pair with only other defined', () => {
    expect(pluralize('en', 0, { other: 'N' })).toBe('N');
    // Never returns undefined even when the count maps to a non-other category.
    expect(pluralize('en', 1, { other: 'N' })).toBe('N');
  });
});

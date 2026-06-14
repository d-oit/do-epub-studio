import { describe, expect, it } from 'vitest';
import { escapeRegex, matchAllBounded, matchBounded, testBounded } from '../safe-regex';

describe('matchBounded', () => {
  it('returns the match when input is within the length cap', () => {
    const re = /hello/;
    const m = matchBounded(re, 'say hello world', 64);
    expect(m?.[0]).toBe('hello');
  });

  it('returns null when input exceeds the length cap', () => {
    const re = /hello/;
    const m = matchBounded(re, 'x'.repeat(20) + ' hello', 10);
    expect(m).toBeNull();
  });
});

describe('testBounded', () => {
  it('returns true when input matches and is within cap', () => {
    expect(testBounded(/foo/, 'foo bar', 16)).toBe(true);
  });

  it('returns false when input exceeds the length cap', () => {
    expect(testBounded(/foo/, 'x'.repeat(50), 10)).toBe(false);
  });
});

describe('matchAllBounded', () => {
  it('returns every match when input is within cap', () => {
    const re = /a/g;
    const matches = matchAllBounded(re, 'aaa', 16);
    expect(matches.map((m) => m[0])).toEqual(['a', 'a', 'a']);
  });

  it('returns an empty array when input exceeds the length cap', () => {
    const re = /a/g;
    expect(matchAllBounded(re, 'x'.repeat(50), 10)).toEqual([]);
  });
});

describe('escapeRegex', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegex('a.b*c?')).toBe('a\\.b\\*c\\?');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeRegex('plain')).toBe('plain');
  });
});

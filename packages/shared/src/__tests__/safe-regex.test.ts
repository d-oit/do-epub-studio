import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
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

// ---------------------------------------------------------------------------
// Property-based tests (fast-check)
// ---------------------------------------------------------------------------

describe('matchBounded (property-based)', () => {
  it('returns null when input length exceeds maxLen for any regex', () => {
    const patterns = [/a/, /hello/, /\d+/, /[a-z]/, /test/];
    fc.assert(
      fc.property(
        fc.constantFrom(...patterns),
        fc.integer({ min: 1, max: 100 }),
        (re, maxLen) => {
          const input = 'x'.repeat(maxLen + 1);
          return matchBounded(re, input, maxLen) === null;
        },
      ),
    );
  });

  it('returns match or null for short input without crashing', () => {
    const patterns = [/a/, /hello/, /\d+/, /[a-z]+/, /test/, /./];
    fc.assert(
      fc.property(
        fc.constantFrom(...patterns),
        fc.string({ minLength: 0, maxLength: 20 }),
        (re, input) => {
          const result = matchBounded(re, input, 100);
          return result === null || Array.isArray(result);
        },
      ),
    );
  });
});

describe('testBounded (property-based)', () => {
  it('returns false when input length exceeds maxLen', () => {
    const patterns = [/a/, /hello/, /\d+/, /[a-z]/, /test/];
    fc.assert(
      fc.property(
        fc.constantFrom(...patterns),
        fc.integer({ min: 1, max: 100 }),
        (re, maxLen) => {
          const input = 'a'.repeat(maxLen + 1);
          return testBounded(re, input, maxLen) === false;
        },
      ),
    );
  });
});

describe('matchAllBounded (property-based)', () => {
  it('returns empty array when input length exceeds maxLen', () => {
    const patterns = [/a/g, /hello/g, /\d+/g, /[a-z]/g, /test/g];
    fc.assert(
      fc.property(
        fc.constantFrom(...patterns),
        fc.integer({ min: 1, max: 100 }),
        (re, maxLen) => {
          const input = 'a'.repeat(maxLen + 1);
          return matchAllBounded(re, input, maxLen).length === 0;
        },
      ),
    );
  });

  it('returns array of matches for short input without crashing', () => {
    const patterns = [/a/g, /hello/g, /\d+/g, /[a-z]/g, /test/g, /./g];
    fc.assert(
      fc.property(
        fc.constantFrom(...patterns),
        fc.string({ minLength: 0, maxLength: 20 }),
        (re, input) => {
          const result = matchAllBounded(re, input, 100);
          return Array.isArray(result);
        },
      ),
    );
  });
});

describe('escapeRegex (property-based)', () => {
  it('escaped string matches itself literally when used in regex', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 50 }), (s) => {
        // eslint-disable-next-line security/detect-non-literal-regexp -- intentional: testing that escapeRegex makes strings safe for RegExp
        const re = new RegExp(escapeRegex(s));
        return re.test(s);
      }),
    );
  });

  it('escaped string is never shorter than the original', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return escapeRegex(s).length >= s.length;
      }),
    );
  });
});

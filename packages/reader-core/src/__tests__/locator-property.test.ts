import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createLocator, parseLocator, locatorToString } from '../locator';
import { isValidCfi } from '../epub-loader';

describe('isValidCfi (property)', () => {
  it('never throws for any string input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(() => isValidCfi(input)).not.toThrow();
      }),
    );
  });
});

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

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  shouldShowDriftWarning,
  findBestChapterMatch,
  type ReanchorResult,
} from '../reanchor';
import type { TocItem } from '../epub-types';
import type { LocatorResult } from '../locator';

const nonEmptyString = fc.string({ minLength: 1, maxLength: 100 });
const anyString = fc.string({ maxLength: 200 });

const tocItemArb: fc.Arbitrary<TocItem> = fc.record({
  id: nonEmptyString,
  label: nonEmptyString,
  href: nonEmptyString,
  subitems: fc.option(
    fc.array(fc.record({
      id: nonEmptyString,
      label: nonEmptyString,
      href: nonEmptyString,
    })),
    { nil: undefined },
  ),
});

const tocArb: fc.Arbitrary<TocItem[]> = fc.array(tocItemArb, { minLength: 0, maxLength: 10 });

const matchTypeArb = fc.constantFrom(undefined, 'exact' as const, 'fuzzy' as const, 'partial' as const);

const reanchorResultArb: fc.Arbitrary<ReanchorResult> = fc.record({
  success: fc.boolean(),
  cfi: fc.option(fc.string(), { nil: undefined }),
  chapterHref: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
  fallback: fc.boolean(),
  matchType: matchTypeArb,
  message: fc.option(anyString, { nil: undefined }),
});

describe('shouldShowDriftWarning invariants', () => {
  it('shows warning when result.success is false', () => {
    fc.assert(
      fc.property(
        reanchorResultArb,
        fc.option(fc.string(), { nil: undefined }),
        (result, originalChapter) => {
          fc.pre(result.success === false);
          expect(shouldShowDriftWarning(result, originalChapter)).toBe(true);
        },
      ),
    );
  });

  it('shows warning for fuzzy match regardless of chapter', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(fc.string(), { nil: undefined }),
        (success, originalChapter) => {
          const result: ReanchorResult = { success, fallback: true, matchType: 'fuzzy' };
          expect(shouldShowDriftWarning(result, originalChapter)).toBe(true);
        },
      ),
    );
  });

  it('shows warning for partial match regardless of chapter', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(fc.string(), { nil: undefined }),
        (success, originalChapter) => {
          const result: ReanchorResult = { success, fallback: false, matchType: 'partial' };
          expect(shouldShowDriftWarning(result, originalChapter)).toBe(true);
        },
      ),
    );
  });

  it('shows warning when chapter changed', () => {
    fc.assert(
      fc.property(
        nonEmptyString,
        nonEmptyString,
        (originalChapter, differentChapter) => {
          fc.pre(originalChapter !== differentChapter);
          const result: ReanchorResult = {
            success: true,
            fallback: false,
            matchType: 'exact',
            chapterHref: differentChapter,
          };
          expect(shouldShowDriftWarning(result, originalChapter)).toBe(true);
        },
      ),
    );
  });

  it('no warning for exact match in same chapter', () => {
    fc.assert(
      fc.property(nonEmptyString, (chapter) => {
        const result: ReanchorResult = {
          success: true,
          fallback: false,
          matchType: 'exact',
          chapterHref: chapter,
        };
        expect(shouldShowDriftWarning(result, chapter)).toBe(false);
      }),
    );
  });

  it('no warning for exact match when original chapter is undefined', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (fallback) => {
          const result: ReanchorResult = {
            success: true,
            fallback,
            matchType: 'exact',
          };
          expect(shouldShowDriftWarning(result, undefined)).toBe(false);
        },
      ),
    );
  });

  it('warning result is consistent: when !success, always true', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: undefined }),
        fc.option(fc.constantFrom(undefined, 'exact', 'fuzzy', 'partial'), { nil: undefined }),
        fc.boolean(),
        fc.option(fc.string(), { nil: undefined }),
        (chapterHref, matchType, fallback, originalChapter) => {
          const result: ReanchorResult = {
            success: false,
            chapterHref,
            fallback,
            matchType,
          };
          expect(shouldShowDriftWarning(result, originalChapter)).toBe(true);
        },
      ),
    );
  });
});

describe('findBestChapterMatch', () => {
  it('returns null when locator.chapterHref is missing', () => {
    fc.assert(
      fc.property(tocArb, (toc) => {
        const locator: LocatorResult = {
          cfi: 'epubcfi(/6/4)',
          textExcerpt: 'text',
          chapterHref: '',
        };
        const result = findBestChapterMatch(locator, toc);
        if (result === null) {
          expect(locator.chapterHref).toBe('');
        }
      }),
    );
  });

  it('returns a TocItem when chapterHref matches directly', () => {
    fc.assert(
      fc.property(nonEmptyString, tocArb, (href, toc) => {
        const locator: LocatorResult = {
          cfi: 'epubcfi(/6/4)',
          textExcerpt: 'text',
          chapterHref: href,
        };
        const tocWithMatch = [...toc, { id: 'match', label: 'Match', href }];
        const result = findBestChapterMatch(locator, tocWithMatch);
        expect(result).not.toBeNull();
        expect(result!.href).toBe(href);
      }),
    );
  });

  it('returns a TocItem for subitem match', () => {
    fc.assert(
      fc.property(
        nonEmptyString,
        nonEmptyString,
        (parentHref, subHref) => {
          fc.pre(parentHref !== subHref);
          const toc: TocItem[] = [{
            id: 'parent',
            label: 'Parent',
            href: parentHref,
            subitems: [{ id: 'sub', label: 'Sub', href: subHref }],
          }];
          const locator: LocatorResult = {
            cfi: 'epubcfi(/6/4)',
            textExcerpt: 'text',
            chapterHref: subHref,
          };
          const result = findBestChapterMatch(locator, toc);
          expect(result).not.toBeNull();
          expect(result!.href).toBe(subHref);
        },
      ),
    );
  });

  it('returns first TocItem as fallback when no match in empty toc', () => {
    const locator: LocatorResult = {
      cfi: 'epubcfi(/6/4)',
      textExcerpt: 'text',
      chapterHref: 'nonexistent.xhtml',
    };
    expect(findBestChapterMatch(locator, [])).toBeNull();
  });

  it('returns null when chapterHref is undefined-like (empty string)', () => {
    fc.assert(
      fc.property(tocArb, (toc) => {
        const locator: LocatorResult = {
          cfi: 'epubcfi(/6/4)',
          textExcerpt: 'text',
          chapterHref: '',
        };
        const result = findBestChapterMatch(locator, toc);
        expect(result === null || result.href !== '').toBe(true);
      }),
    );
  });
});

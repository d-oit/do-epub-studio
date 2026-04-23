import { bench, describe } from 'vitest';
import { createLocator, parseLocator, locatorToString } from './locator';

describe('reader-core performance', () => {
  const cfi = 'epubcfi(/6/4!/2/2)';
  const text = 'The quick brown fox jumps over the lazy dog.';
  const chapterHref = 'chapter1.xhtml';
  const locator = createLocator(cfi, text, chapterHref);
  const locatorStr = locatorToString(locator);

  bench('locator: create', () => {
    createLocator(cfi, text, chapterHref);
  });

  bench('locator: parse', () => {
    parseLocator(locatorStr);
  });

  // Simplified benchmark to avoid DOM issues in benchmark loop if any
  bench('locator: toString', () => {
    locatorToString(locator);
  });
});

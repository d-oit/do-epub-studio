import { bench, describe } from 'vitest';
import { createLocator, parseLocator, locatorToString } from './locator';
import { reanchorByText } from './reanchor';

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

  describe('reanchorByText', () => {
    const targetText = 'The quick brown fox jumps over the lazy dog.';
    const toc = [
      { id: '1', label: 'Chapter 1', href: 'ch1.xhtml' },
      { id: '2', label: 'Chapter 2', href: 'ch2.xhtml', subitems: [{ id: '2.1', label: 'Section 2.1', href: 'ch2-1.xhtml' }] },
      { id: '3', label: 'Chapter 3', href: 'ch3.xhtml' },
    ];
    const mockLoadContent = async (href: string) => {
      if (href === 'ch3.xhtml') return 'Some other content here.';
      if (href === 'ch2-1.xhtml') return 'The quick brown fox jumps over the lazy dog.';
      return 'Nothing interesting here.';
    };

    bench('reanchor: Pass 1 (exact match in subitem)', async () => {
      await reanchorByText(targetText, toc, mockLoadContent);
    });

    const targetTextFuzzy = 'The fast brown fox leaps over a sleepy dog.';
    bench('reanchor: Pass 2 (fuzzy match)', async () => {
      await reanchorByText(targetTextFuzzy, toc, mockLoadContent);
    });
  });
});

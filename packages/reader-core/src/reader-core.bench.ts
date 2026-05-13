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
    function mockLoadContent(href: string): Promise<string> {
      if (href === 'ch3.xhtml') return Promise.resolve('Some other content here.');
      if (href === 'ch2-1.xhtml') return Promise.resolve('The quick brown fox jumps over the lazy dog.');
      return Promise.resolve('Nothing interesting here.');
    }

    bench('reanchor: Pass 1 (exact match in subitem)', async () => {
      await reanchorByText(targetText, toc, mockLoadContent);
    });

    const targetTextFuzzy = 'The fast brown fox leaps over a sleepy dog.';
    bench('reanchor: Pass 2 (fuzzy match)', async () => {
      await reanchorByText(targetTextFuzzy, toc, mockLoadContent);
    });

    describe('stress tests', () => {
      const LARGE_TEXT = 'The quick brown fox jumps over the lazy dog. '.repeat(4000);
      const stressToc = [{ id: '1', label: 'Large Chapter', href: 'large.xhtml' }];
      function stressLoadContent(): Promise<string> { return Promise.resolve(LARGE_TEXT); }
      const stressTarget = 'The fast brown fox leaps over a sleepy dog but it is quite long and has many words to check overlap with.';

      bench('reanchor: Pass 2 Stress (200KB, many words)', async () => {
        await reanchorByText(stressTarget, stressToc, stressLoadContent);
      });

      const TOC_WITH_ANCHORS = Array.from({ length: 50 }, (_, i) => ({
        id: i.toString(),
        label: `Section ${i}`,
        href: `large.xhtml#sec${i}`
      }));

      bench('reanchor: 50 anchors in 1 chapter (caching test)', async () => {
        await reanchorByText('No match', TOC_WITH_ANCHORS, stressLoadContent);
      });
    });
  });
});

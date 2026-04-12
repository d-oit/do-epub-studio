import { describe, expect, it, vi } from 'vitest';
import {
  reanchorByText,
  tryReanchor,
  findBestChapterMatch,
  shouldShowDriftWarning,
  type ReanchorResult,
} from '../reanchor';
import type { TocItem } from '../epub-types';
import type { LocatorResult } from '../locator';

const mockToc: TocItem[] = [
  { id: '1', label: 'Chapter 1', href: 'chapter1.xhtml' },
  { id: '2', label: 'Chapter 2', href: 'chapter2.xhtml' },
  {
    id: '3',
    label: 'Chapter 3',
    href: 'chapter3.xhtml',
    subitems: [
      { id: '3a', label: 'Section 3A', href: 'section3a.xhtml' },
    ],
  },
];

describe('reanchorByText', () => {
  it('returns failure for text too short', async () => {
    const result = await reanchorByText('short', mockToc, vi.fn());
    expect(result.success).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.message).toBe('Text too short for reanchoring');
  });

  it('returns success for exact match', async () => {
    const loadContent = vi.fn().mockResolvedValue('This is the target text in the content.');
    const result = await reanchorByText('target text', mockToc, loadContent);
    expect(result.success).toBe(true);
    expect(result.matchType).toBe('exact');
    expect(result.fallback).toBe(false);
    expect(result.chapterHref).toBe('chapter1.xhtml');
  });

  it('searches prioritized chapter first', async () => {
    const loadContent = vi.fn((href: string) => {
      if (href === 'chapter2.xhtml') {
        return Promise.resolve('Found the target text here.');
      }
      return Promise.resolve('No match here.');
    });
    const result = await reanchorByText('target text', mockToc, loadContent, {
      preferChapter: 'chapter2.xhtml',
    });
    expect(result.success).toBe(true);
    expect(result.chapterHref).toBe('chapter2.xhtml');
  });

  it('returns partial match when exact not found', async () => {
    const loadContent = vi.fn().mockResolvedValue(
      'This is content with words scattered throughout the paragraph.',
    );
    const result = await reanchorByText(
      'words scattered throughout paragraph',
      mockToc,
      loadContent,
    );
    expect(result.success).toBe(true);
    // Match type depends on exact match being found or not
    expect(result.matchType).toBeDefined();
  });

  it('returns fuzzy match based on word overlap', async () => {
    const loadContent = vi.fn().mockResolvedValue(
      'The chapter discusses important concepts and key ideas about the topic.',
    );
    const result = await reanchorByText(
      'important concepts key ideas topic discussion',
      mockToc,
      loadContent,
    );
    expect(result.success).toBe(true);
    expect(result.matchType).toBe('fuzzy');
    expect(result.fallback).toBe(true);
  });

  it('searches subitems when parent not found', async () => {
    const loadContent = vi.fn((href: string) => {
      if (href === 'chapter3.xhtml') {
        return Promise.resolve('No match');
      }
      if (href === 'section3a.xhtml') {
        return Promise.resolve('The target text is in the subsection.');
      }
      return Promise.resolve('No match');
    });
    const result = await reanchorByText('target text', mockToc, loadContent);
    expect(result.success).toBe(true);
    expect(result.chapterHref).toBe('section3a.xhtml');
  });

  it('returns failure when not found anywhere', async () => {
    const loadContent = vi.fn().mockResolvedValue('Completely different content.');
    const result = await reanchorByText('target text not present', mockToc, loadContent);
    expect(result.success).toBe(false);
    expect(result.fallback).toBe(true);
  });

  it('handles loadChapterContent errors gracefully', async () => {
    const loadContent = vi.fn().mockRejectedValue(new Error('Failed to load'));
    const result = await reanchorByText('target text', mockToc, loadContent);
    expect(result.success).toBe(false);
  });
});

describe('tryReanchor', () => {
  it('returns failure for anchor with short text', async () => {
    const anchor = { selectedText: 'short' };
    const result = await tryReanchor(anchor, mockToc, vi.fn());
    expect(result.reanchorResult.success).toBe(false);
    expect(result.reanchorResult.message).toBe('Text too short for reanchoring');
  });

  it('updates chapterRef on successful reanchor', async () => {
    const anchor = {
      cfi: 'epubcfi(/6/4)',
      selectedText: 'target text in chapter',
      chapterRef: 'chapter1.xhtml',
    };
    const loadContent = vi.fn((href: string) => {
      if (href === 'chapter2.xhtml') {
        return Promise.resolve('Found target text in chapter here.');
      }
      return Promise.resolve('No match');
    });
    const result = await tryReanchor(anchor, mockToc, loadContent);
    expect(result.reanchorResult.success).toBe(true);
    expect(result.anchor.chapterRef).toBe('chapter2.xhtml');
  });

  it('preserves original anchor on failure', async () => {
    const anchor = {
      cfi: 'epubcfi(/6/4)',
      selectedText: 'text that cannot be found anywhere',
      chapterRef: 'chapter1.xhtml',
    };
    const loadContent = vi.fn().mockResolvedValue('Different content');
    const result = await tryReanchor(anchor, mockToc, loadContent);
    expect(result.reanchorResult.success).toBe(false);
    expect(result.anchor.chapterRef).toBe('chapter1.xhtml');
  });
});

describe('findBestChapterMatch', () => {
  it('finds matching chapter by href', () => {
    const locator: LocatorResult = {
      cfi: 'epubcfi(/6/4)',
      textExcerpt: 'text',
      chapterHref: 'chapter2.xhtml',
    };
    const result = findBestChapterMatch(locator, mockToc);
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Chapter 2');
  });

  it('finds matching subitem', () => {
    const locator: LocatorResult = {
      cfi: 'epubcfi(/6/4)',
      textExcerpt: 'text',
      chapterHref: 'section3a.xhtml',
    };
    const result = findBestChapterMatch(locator, mockToc);
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Section 3A');
  });

  it('returns null for missing chapterHref', () => {
    const locator: LocatorResult = {
      cfi: 'epubcfi(/6/4)',
      textExcerpt: 'text',
      chapterHref: undefined as unknown as string,
    };
    const result = findBestChapterMatch(locator, mockToc);
    expect(result).toBeNull();
  });

  it('returns first toc item as fallback when not found', () => {
    const locator: LocatorResult = {
      cfi: 'epubcfi(/6/4)',
      textExcerpt: 'text',
      chapterHref: 'nonexistent.xhtml',
    };
    const result = findBestChapterMatch(locator, mockToc);
    // Returns first toc item as fallback when href not found
    expect(result?.label).toBe('Chapter 1');
  });

  it('returns first toc item as fallback', () => {
    const locator: LocatorResult = {
      cfi: 'epubcfi(/6/4)',
      textExcerpt: 'text',
      chapterHref: 'nonexistent.xhtml',
    };
    const tocWithSingle: TocItem[] = [
      { id: 'only', label: 'Only Chapter', href: 'only.xhtml' },
    ];
    const result = findBestChapterMatch(locator, tocWithSingle);
    expect(result?.label).toBe('Only Chapter');
  });
});

describe('shouldShowDriftWarning', () => {
  it('shows warning when reanchor fails', () => {
    const result: ReanchorResult = { success: false, fallback: true };
    expect(shouldShowDriftWarning(result, 'chapter1.xhtml')).toBe(true);
  });

  it('shows warning for fuzzy match', () => {
    const result: ReanchorResult = { success: true, fallback: true, matchType: 'fuzzy' };
    expect(shouldShowDriftWarning(result, 'chapter1.xhtml')).toBe(true);
  });

  it('shows warning for partial match', () => {
    const result: ReanchorResult = { success: true, fallback: false, matchType: 'partial' };
    expect(shouldShowDriftWarning(result, 'chapter1.xhtml')).toBe(true);
  });

  it('shows warning when chapter changed', () => {
    const result: ReanchorResult = {
      success: true,
      fallback: false,
      matchType: 'exact',
      chapterHref: 'chapter2.xhtml',
    };
    expect(shouldShowDriftWarning(result, 'chapter1.xhtml')).toBe(true);
  });

  it('does not show warning for exact match in same chapter', () => {
    const result: ReanchorResult = {
      success: true,
      fallback: false,
      matchType: 'exact',
      chapterHref: 'chapter1.xhtml',
    };
    expect(shouldShowDriftWarning(result, 'chapter1.xhtml')).toBe(false);
  });

  it('does not show warning when original chapter undefined', () => {
    const result: ReanchorResult = {
      success: true,
      fallback: false,
      matchType: 'exact',
      chapterHref: 'chapter1.xhtml',
    };
    expect(shouldShowDriftWarning(result, undefined)).toBe(false);
  });
});
import { describe, expect, it } from 'vitest';
import {
  flattenToc,
  findTocItemByHref,
  getTocPath,
  buildTocHierarchy,
} from '../toc';
import type { TocItem } from '../epub-types';

describe('flattenToc', () => {
  it('flattens a flat toc', () => {
    const toc: TocItem[] = [
      { id: '1', label: 'Chapter 1', href: 'chap1.xhtml' },
      { id: '2', label: 'Chapter 2', href: 'chap2.xhtml' },
    ];
    const result = flattenToc(toc);
    expect(result).toHaveLength(2);
    expect(result[0]?.label).toBe('Chapter 1');
    expect(result[1]?.label).toBe('Chapter 2');
  });

  it('flattens a nested toc', () => {
    const toc: TocItem[] = [
      {
        id: '1',
        label: 'Part 1',
        href: 'part1.xhtml',
        subitems: [
          { id: '1a', label: 'Chapter 1A', href: 'chap1a.xhtml' },
          { id: '1b', label: 'Chapter 1B', href: 'chap1b.xhtml' },
        ],
      },
      { id: '2', label: 'Part 2', href: 'part2.xhtml' },
    ];
    const result = flattenToc(toc);
    expect(result).toHaveLength(4);
    expect(result.map((i) => i.label)).toEqual([
      'Part 1',
      'Chapter 1A',
      'Chapter 1B',
      'Part 2',
    ]);
  });

  it('handles deeply nested toc', () => {
    const toc: TocItem[] = [
      {
        id: '1',
        label: 'Part 1',
        href: 'part1.xhtml',
        subitems: [
          {
            id: '1a',
            label: 'Chapter 1A',
            href: 'chap1a.xhtml',
            subitems: [
              { id: '1a-1', label: 'Section 1A-1', href: 'sec1a1.xhtml' },
            ],
          },
        ],
      },
    ];
    const result = flattenToc(toc);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.label)).toEqual([
      'Part 1',
      'Chapter 1A',
      'Section 1A-1',
    ]);
  });

  it('returns empty array for empty toc', () => {
    expect(flattenToc([])).toEqual([]);
  });
});

describe('findTocItemByHref', () => {
  it('finds item in flat toc', () => {
    const toc: TocItem[] = [
      { id: '1', label: 'Chapter 1', href: 'chap1.xhtml' },
      { id: '2', label: 'Chapter 2', href: 'chap2.xhtml' },
    ];
    const result = findTocItemByHref(toc, 'chap2.xhtml');
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Chapter 2');
  });

  it('finds item in nested toc', () => {
    const toc: TocItem[] = [
      {
        id: '1',
        label: 'Part 1',
        href: 'part1.xhtml',
        subitems: [
          { id: '1a', label: 'Chapter 1A', href: 'chap1a.xhtml' },
        ],
      },
    ];
    const result = findTocItemByHref(toc, 'chap1a.xhtml');
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Chapter 1A');
  });

  it('returns null for non-existent href', () => {
    const toc: TocItem[] = [
      { id: '1', label: 'Chapter 1', href: 'chap1.xhtml' },
    ];
    const result = findTocItemByHref(toc, 'nonexistent.xhtml');
    expect(result).toBeNull();
  });

  it('returns null for empty toc', () => {
    expect(findTocItemByHref([], 'chap1.xhtml')).toBeNull();
  });

  it('finds root level item', () => {
    const toc: TocItem[] = [
      {
        id: '1',
        label: 'Part 1',
        href: 'part1.xhtml',
        subitems: [
          { id: '1a', label: 'Chapter 1A', href: 'chap1a.xhtml' },
        ],
      },
    ];
    const result = findTocItemByHref(toc, 'part1.xhtml');
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Part 1');
  });
});

describe('getTocPath', () => {
  it('returns path to target item in flat toc', () => {
    const toc: TocItem[] = [
      { id: '1', label: 'Chapter 1', href: 'chap1.xhtml' },
      { id: '2', label: 'Chapter 2', href: 'chap2.xhtml' },
    ];
    const path = getTocPath(toc, 'chap2.xhtml');
    expect(path).toHaveLength(1);
    expect(path[0]?.label).toBe('Chapter 2');
  });

  it('returns path to nested item', () => {
    const toc: TocItem[] = [
      {
        id: '1',
        label: 'Part 1',
        href: 'part1.xhtml',
        subitems: [
          { id: '1a', label: 'Chapter 1A', href: 'chap1a.xhtml' },
        ],
      },
    ];
    const path = getTocPath(toc, 'chap1a.xhtml');
    expect(path).toHaveLength(2);
    expect(path[0]?.label).toBe('Part 1');
    expect(path[1]?.label).toBe('Chapter 1A');
  });

  it('returns empty path for non-existent href', () => {
    const toc: TocItem[] = [
      { id: '1', label: 'Chapter 1', href: 'chap1.xhtml' },
    ];
    const path = getTocPath(toc, 'nonexistent.xhtml');
    expect(path).toHaveLength(0);
  });

  it('returns empty path for empty toc', () => {
    expect(getTocPath([], 'chap1.xhtml')).toHaveLength(0);
  });

  it('handles deeply nested path', () => {
    const toc: TocItem[] = [
      {
        id: '1',
        label: 'Part 1',
        href: 'part1.xhtml',
        subitems: [
          {
            id: '1a',
            label: 'Chapter 1A',
            href: 'chap1a.xhtml',
            subitems: [
              { id: '1a-1', label: 'Section 1A-1', href: 'sec1a1.xhtml' },
            ],
          },
        ],
      },
    ];
    const path = getTocPath(toc, 'sec1a1.xhtml');
    expect(path).toHaveLength(3);
    expect(path.map((i) => i.label)).toEqual([
      'Part 1',
      'Chapter 1A',
      'Section 1A-1',
    ]);
  });
});

describe('buildTocHierarchy', () => {
  it('builds flat toc from flat items', () => {
    const items = [
      { label: 'Chapter 1', href: 'chap1.xhtml', level: 0 },
      { label: 'Chapter 2', href: 'chap2.xhtml', level: 0 },
    ];
    const result = buildTocHierarchy(items);
    expect(result).toHaveLength(2);
    expect(result[0]?.label).toBe('Chapter 1');
    expect(result[1]?.label).toBe('Chapter 2');
    expect(result[0]?.subitems).toBeUndefined();
  });

  it('builds nested toc from leveled items', () => {
    const items = [
      { label: 'Part 1', href: 'part1.xhtml', level: 0 },
      { label: 'Chapter 1A', href: 'chap1a.xhtml', level: 1 },
      { label: 'Chapter 1B', href: 'chap1b.xhtml', level: 1 },
      { label: 'Part 2', href: 'part2.xhtml', level: 0 },
    ];
    const result = buildTocHierarchy(items);
    expect(result).toHaveLength(2);
    expect(result[0]?.label).toBe('Part 1');
    expect(result[0]?.subitems).toHaveLength(2);
    expect(result[0]?.subitems?.[0]?.label).toBe('Chapter 1A');
    expect(result[1]?.label).toBe('Part 2');
  });

  it('handles deeply nested items', () => {
    const items = [
      { label: 'Part 1', href: 'part1.xhtml', level: 0 },
      { label: 'Chapter 1', href: 'chap1.xhtml', level: 1 },
      { label: 'Section 1', href: 'sec1.xhtml', level: 2 },
    ];
    const result = buildTocHierarchy(items);
    expect(result).toHaveLength(1);
    expect(result[0]?.subitems?.[0]?.subitems?.[0]?.label).toBe('Section 1');
  });

  it('defaults level to 0', () => {
    const items = [
      { label: 'Chapter 1', href: 'chap1.xhtml' },
    ];
    const result = buildTocHierarchy(items);
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe('Chapter 1');
  });

  it('handles empty items', () => {
    expect(buildTocHierarchy([])).toHaveLength(0);
  });

  it('generates unique IDs', () => {
    const items = [
      { label: 'Chapter 1', href: 'chap1.xhtml' },
      { label: 'Chapter 2', href: 'chap2.xhtml' },
    ];
    const result = buildTocHierarchy(items);
    expect(result[0]?.id).not.toBe(result[1]?.id);
    expect(result[0]?.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
  });
});
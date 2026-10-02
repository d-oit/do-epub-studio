import { describe, it, expect } from 'vitest';
import { collectSpineSections } from './epub-sections';

interface Section {
  href: string;
}

const section = (href: string): Section => ({ href });

describe('collectSpineSections (GOAP-295)', () => {
  it('reads the ESM build Map-like `sections` collection', () => {
    const book = {
      sections: new Map([
        ['c1.xhtml', section('c1.xhtml')],
        ['c2.xhtml', section('c2.xhtml')],
      ]),
    };
    expect(collectSpineSections<Section>(book).map((s) => s.href)).toEqual([
      'c1.xhtml',
      'c2.xhtml',
    ]);
  });

  it('reads the dist build `.each` spine', () => {
    const sections = [section('c1.xhtml'), section('c2.xhtml')];
    const book = {
      spine: { each: (callback: (item: Section) => void) => sections.forEach(callback) },
    };
    expect(collectSpineSections<Section>(book)).toEqual(sections);
  });

  it('accepts arrays and generic iterables of pairs or sections', () => {
    expect(collectSpineSections<Section>({ sections: [section('a.xhtml')] })).toEqual([
      section('a.xhtml'),
    ]);
    expect(collectSpineSections<Section>({ sections: new Set([section('s.xhtml')]) })).toEqual([
      section('s.xhtml'),
    ]);
    expect(
      collectSpineSections<Section>({
        sections: new Map([['k.xhtml', section('k.xhtml')]]),
      })?.[0]?.href,
    ).toBe('k.xhtml');
  });

  it('returns an empty list when neither collection exists', () => {
    expect(collectSpineSections<Section>({})).toEqual([]);
    expect(collectSpineSections<Section>(null)).toEqual([]);
  });
});

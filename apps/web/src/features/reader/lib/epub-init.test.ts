import { describe, expect, it, vi, type Mock } from 'vitest';
import type { Contents, Rendition } from '@intity/epub-js';
import { applyDirection } from './epub-init';

interface FakeContents extends Contents {
  document: Document;
  direction: Mock;
  css: Mock;
}

function makeContents(): FakeContents {
  return {
    document: document.implementation.createHTMLDocument('chapter'),
    direction: vi.fn(),
    css: vi.fn(),
  } as unknown as FakeContents;
}

function makeRendition(contents: Contents[]) {
  let hook: ((contents: Contents) => void) | null = null;
  const register = vi.fn((fn: (contents: Contents) => void) => {
    hook = fn;
  });
  const rendition = {
    hooks: { content: { register } },
    getContents: () => contents,
  } as unknown as Rendition;
  return { rendition, register, trigger: (next: Contents) => hook?.(next) };
}

describe('applyDirection', () => {
  it('applies the current direction to the chapter already rendered', () => {
    const contents = makeContents();
    const { rendition } = makeRendition([contents]);

    applyDirection(rendition, 'rtl');

    expect(contents.document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(contents.direction).toHaveBeenCalledWith('rtl');
  });

  it('updates the rendered chapter when the direction changes', () => {
    const contents = makeContents();
    const { rendition } = makeRendition([contents]);

    applyDirection(rendition, 'rtl');
    applyDirection(rendition, 'ltr');

    expect(contents.document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(contents.direction).toHaveBeenLastCalledWith('ltr');
  });

  it('registers the content hook once and gives later chapters the latest direction', () => {
    const first = makeContents();
    const { rendition, register, trigger } = makeRendition([first]);

    applyDirection(rendition, 'ltr');
    applyDirection(rendition, 'rtl');

    expect(register).toHaveBeenCalledTimes(1);

    const second = makeContents();
    trigger(second);

    expect(second.document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});

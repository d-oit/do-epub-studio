import { describe, expect, it, vi } from 'vitest';
import { createThemeApplier } from './useReaderEpub.helpers';
import type { Rendition } from '@intity/epub-js';

const FONT_SIZES = { small: '14px', medium: '16px', large: '18px', xlarge: '20px' } as const;

function createHarness(options: { fixedLayout?: boolean } = {}) {
  const container = document.createElement('div');
  container.style.setProperty('--color-background', 'rgb(255, 255, 255)');
  container.style.setProperty('--color-foreground', 'rgb(17, 17, 17)');
  document.body.append(container);

  const rules = new Map<string, Record<string, unknown>>();
  const themes = {
    current: null as string | null,
    registerRules: vi.fn((name: string, value: Record<string, unknown>) => {
      rules.set(name, value);
    }),
    select: vi.fn((name: string | null) => {
      themes.current = name;
    }),
  };
  const rendition = { themes } as unknown as Rendition;

  const applyTheme = createThemeApplier({
    rootRef: { current: container },
    readerTheme: 'light',
    fixedLayoutRef: { current: options.fixedLayout ?? false },
    readerFontSize: 'medium',
    readerLineHeight: 1.5,
    readerFontFamily: 'serif',
    readerWritingMode: 'horizontal-tb',
  });

  return { applyTheme, rendition, themes, rules, container };
}

describe('createThemeApplier', () => {
  it('selects the reader theme on first application', () => {
    const { applyTheme, rendition, themes } = createHarness();

    applyTheme(rendition);

    expect(themes.select.mock.calls).toEqual([['reader-theme']]);
    expect(themes.current).toBe('reader-theme');
  });

  it('re-injects the theme when a preference changes and it is already selected', () => {
    const { applyTheme, rendition, themes, rules } = createHarness();

    applyTheme(rendition);
    const firstRules = rules.get('reader-theme') as { body: Record<string, string> };

    applyTheme(rendition);
    const secondRules = rules.get('reader-theme') as { body: Record<string, string> };

    // The open chapter only receives new rules if the theme is deselected first;
    // epub.js `select()` returns early while the same theme is current.
    expect(themes.select.mock.calls).toEqual([['reader-theme'], [null], ['reader-theme']]);
    expect(firstRules.body['font-size']).toBe('16px');
    expect(secondRules.body['font-size']).toBe('16px');
  });

  it('keeps fixed-layout content out of the typography overrides', () => {
    const { applyTheme, rendition, rules } = createHarness({ fixedLayout: true });

    applyTheme(rendition);

    const { body } = rules.get('reader-theme') as { body: Record<string, string> };
    expect(body['font-size']).toBeUndefined();
    expect(body['line-height']).toBeUndefined();
    expect(body['font-family']).toBeUndefined();
    expect(body['background']).toBe('rgb(255, 255, 255)');
  });

  it('applies the new font size after a preference change', () => {
    const { rendition, rules, container } = createHarness();

    createThemeApplier({
      rootRef: { current: container },
      readerTheme: 'light',
      fixedLayoutRef: { current: false },
      readerFontSize: 'medium',
      readerLineHeight: 1.5,
      readerFontFamily: 'serif',
      readerWritingMode: 'horizontal-tb',
    })(rendition);

    createThemeApplier({
      rootRef: { current: container },
      readerTheme: 'light',
      fixedLayoutRef: { current: false },
      readerFontSize: 'large',
      readerLineHeight: 1.5,
      readerFontFamily: 'sans-serif',
      readerWritingMode: 'vertical-rl',
    })(rendition);

    const { body } = rules.get('reader-theme') as { body: Record<string, string> };
    expect(body['font-size']).toBe(FONT_SIZES.large);
    expect(body['font-family']).toBe('sans-serif');
    expect(body['writing-mode']).toBe('vertical-rl');
  });
});

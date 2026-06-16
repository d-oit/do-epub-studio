import { describe, it, expect, beforeEach } from 'vitest';
import { usePreferencesStore, FONT_SIZES, LINE_HEIGHTS } from '../stores/preferences';

describe('FONT_SIZES', () => {
  it('has all font sizes', () => {
    expect(FONT_SIZES.small).toBe('14px');
    expect(FONT_SIZES.medium).toBe('16px');
    expect(FONT_SIZES.large).toBe('18px');
    expect(FONT_SIZES.xlarge).toBe('20px');
  });
});

describe('LINE_HEIGHTS', () => {
  it('has all line heights', () => {
    expect(LINE_HEIGHTS[1]).toBe('1.4');
    expect(LINE_HEIGHTS[2]).toBe('1.6');
    expect(LINE_HEIGHTS[3]).toBe('1.8');
  });
});

describe('usePreferencesStore', () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      reader: {
        theme: 'system',
        fontFamily: 'serif',
        fontSize: 'medium',
        lineHeight: 2,
        pageWidth: 'normal',
        direction: 'default',
        writingMode: 'horizontal-tb',
      },
    });
  });

  it('has initial state', () => {
    const state = usePreferencesStore.getState();
    expect(state.reader.theme).toBe('system');
    expect(state.reader.fontFamily).toBe('serif');
    expect(state.reader.fontSize).toBe('medium');
  });

  it('sets theme', () => {
    usePreferencesStore.getState().setTheme('dark');
    expect(usePreferencesStore.getState().reader.theme).toBe('dark');
  });

  it('does not set theme if same', () => {
    usePreferencesStore.getState().setTheme('system');
    expect(usePreferencesStore.getState().reader.theme).toBe('system');
  });

  it('sets font family', () => {
    usePreferencesStore.getState().setFontFamily('monospace');
    expect(usePreferencesStore.getState().reader.fontFamily).toBe('monospace');
  });

  it('does not set font family if same', () => {
    usePreferencesStore.getState().setFontFamily('serif');
    expect(usePreferencesStore.getState().reader.fontFamily).toBe('serif');
  });

  it('sets font size', () => {
    usePreferencesStore.getState().setFontSize('large');
    expect(usePreferencesStore.getState().reader.fontSize).toBe('large');
  });

  it('does not set font size if same', () => {
    usePreferencesStore.getState().setFontSize('medium');
    expect(usePreferencesStore.getState().reader.fontSize).toBe('medium');
  });

  it('sets line height', () => {
    usePreferencesStore.getState().setLineHeight(3);
    expect(usePreferencesStore.getState().reader.lineHeight).toBe(3);
  });

  it('does not set line height if same', () => {
    usePreferencesStore.getState().setLineHeight(2);
    expect(usePreferencesStore.getState().reader.lineHeight).toBe(2);
  });

  it('sets page width', () => {
    usePreferencesStore.getState().setPageWidth('wide');
    expect(usePreferencesStore.getState().reader.pageWidth).toBe('wide');
  });

  it('does not set page width if same', () => {
    usePreferencesStore.getState().setPageWidth('normal');
    expect(usePreferencesStore.getState().reader.pageWidth).toBe('normal');
  });

  it('sets direction', () => {
    usePreferencesStore.getState().setDirection('rtl');
    expect(usePreferencesStore.getState().reader.direction).toBe('rtl');
  });

  it('does not set direction if same', () => {
    usePreferencesStore.getState().setDirection('default');
    expect(usePreferencesStore.getState().reader.direction).toBe('default');
  });

  it('sets writing mode', () => {
    usePreferencesStore.getState().setWritingMode('vertical-rl');
    expect(usePreferencesStore.getState().reader.writingMode).toBe('vertical-rl');
  });

  it('does not set writing mode if same', () => {
    usePreferencesStore.getState().setWritingMode('horizontal-tb');
    expect(usePreferencesStore.getState().reader.writingMode).toBe('horizontal-tb');
  });
});

import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'sepia' | 'system';
export type FontFamily = 'serif' | 'sans-serif' | 'monospace';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

interface ReaderPreferences {
  theme: Theme;
  fontFamily: FontFamily;
  fontSize: FontSize;
  lineHeight: number;
  pageWidth: 'narrow' | 'normal' | 'wide' | 'full';
}

interface PreferencesState {
  reader: ReaderPreferences;
  setTheme: (theme: Theme) => void;
  setFontFamily: (fontFamily: FontFamily) => void;
  setFontSize: (fontSize: FontSize) => void;
  setLineHeight: (lineHeight: number) => void;
  setPageWidth: (pageWidth: 'narrow' | 'normal' | 'wide' | 'full') => void;
}

const FONT_SIZES: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
  xlarge: '20px',
};

const LINE_HEIGHTS: Record<number, string> = {
  1: '1.4',
  2: '1.6',
  3: '1.8',
};

export const usePreferencesStore = create<PreferencesState>()(
  (set) => ({
    reader: {
      theme: 'system',
      fontFamily: 'serif',
      fontSize: 'medium',
      lineHeight: 1.6,
      pageWidth: 'normal',
    },
    setTheme: (theme) =>
      set((state) => ({ reader: { ...state.reader, theme } })),
    setFontFamily: (fontFamily) =>
      set((state) => ({ reader: { ...state.reader, fontFamily } })),
    setFontSize: (fontSize) =>
      set((state) => ({ reader: { ...state.reader, fontSize } })),
    setLineHeight: (lineHeight) =>
      set((state) => ({ reader: { ...state.reader, lineHeight } })),
    setPageWidth: (pageWidth) =>
      set((state) => ({ reader: { ...state.reader, pageWidth } })),
  })
);

export { FONT_SIZES, LINE_HEIGHTS };

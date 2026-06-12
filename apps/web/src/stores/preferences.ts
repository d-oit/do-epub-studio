import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'sepia' | 'system';
export type FontFamily = 'serif' | 'sans-serif' | 'monospace';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type PageDirection = 'ltr' | 'rtl' | 'default';
export type WritingMode = 'horizontal-tb' | 'vertical-rl' | 'vertical-lr';

interface ReaderPreferences {
  theme: Theme;
  fontFamily: FontFamily;
  fontSize: FontSize;
  lineHeight: number;
  pageWidth: 'narrow' | 'normal' | 'wide' | 'full';
  direction: PageDirection;
  writingMode: WritingMode;
}

interface PreferencesState {
  reader: ReaderPreferences;
  setTheme: (theme: Theme) => void;
  setFontFamily: (fontFamily: FontFamily) => void;
  setFontSize: (fontSize: FontSize) => void;
  setLineHeight: (lineHeight: number) => void;
  setPageWidth: (pageWidth: 'narrow' | 'normal' | 'wide' | 'full') => void;
  setDirection: (direction: PageDirection) => void;
  setWritingMode: (writingMode: WritingMode) => void;
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

const cookieStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`));
    if (!cookie) return null;
    const value = cookie.split('=')[1];
    return value ? decodeURIComponent(value) : null;
  },
  setItem: (name: string, value: string): void => {
    if (typeof document === 'undefined') return;
    const current = cookieStorage.getItem(name);
    if (current === value) return;
    // Set cookie with 1 year expiry and SameSite=Lax for SPA navigation support
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
  },
  removeItem: (name: string): void => {
    document.cookie = `${name}=; path=/; max-age=0`;
  },
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      reader: {
        theme: 'system',
        fontFamily: 'serif',
        fontSize: 'medium',
        lineHeight: 2,
        pageWidth: 'normal',
        direction: 'default',
        writingMode: 'horizontal-tb',
      },
      setTheme: (theme) => {
        if (get().reader.theme === theme) return;
        set((state) => ({ reader: { ...state.reader, theme } }));
      },
      setFontFamily: (fontFamily) => set((state) => {
        if (state.reader.fontFamily === fontFamily) return state;
        return { reader: { ...state.reader, fontFamily } };
      }),
      setFontSize: (fontSize) => set((state) => {
        if (state.reader.fontSize === fontSize) return state;
        return { reader: { ...state.reader, fontSize } };
      }),
      setLineHeight: (lineHeight) => set((state) => {
        if (state.reader.lineHeight === lineHeight) return state;
        return { reader: { ...state.reader, lineHeight } };
      }),
      setPageWidth: (pageWidth) => set((state) => {
        if (state.reader.pageWidth === pageWidth) return state;
        return { reader: { ...state.reader, pageWidth } };
      }),
      setDirection: (direction) => set((state) => {
        if (state.reader.direction === direction) return state;
        return { reader: { ...state.reader, direction } };
      }),
      setWritingMode: (writingMode) => set((state) => {
        if (state.reader.writingMode === writingMode) return state;
        return { reader: { ...state.reader, writingMode } };
      }),
    }),
    {
      name: 'do-epub-preferences',
      storage: createJSONStorage(() => cookieStorage),
    },
  ),
);

export { FONT_SIZES, LINE_HEIGHTS };

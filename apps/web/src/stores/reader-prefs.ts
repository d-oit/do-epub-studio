import { create } from 'zustand';

export type ReaderTheme = 'light' | 'dark' | 'sepia' | 'paper';

export type ReaderPrefs = {
  fontScale: number;      // 0.85–1.6
  lineHeight: number;     // 1.4–1.9
  margin: 'narrow' | 'default' | 'wide';
  theme: ReaderTheme;
  fontFamily: 'serif' | 'sans';
};

export const DEFAULT_PREFS: ReaderPrefs = {
  fontScale: 1,
  lineHeight: 1.65,
  margin: 'default',
  theme: 'paper',
  fontFamily: 'serif',
};

interface ReaderPrefsState {
  prefs: ReaderPrefs;
  userId: string | null;
  setUserId: (userId: string | null) => void;
  updatePrefs: (updates: Partial<ReaderPrefs>) => void;
  loadPrefs: (userId?: string | null) => void;
}

function getDbKey(userId?: string | null) {
  return `reader:prefs:${userId || 'anonymous'}`;
}

export const useReaderPrefsStore = create<ReaderPrefsState>((set, get) => ({
  prefs: DEFAULT_PREFS,
  userId: null,
  setUserId: (userId) => {
    set({ userId });
    get().loadPrefs(userId);
  },
  updatePrefs: (updates) => {
    const newPrefs = { ...get().prefs, ...updates };
    set({ prefs: newPrefs });
    const key = getDbKey(get().userId);
    try {
      localStorage.setItem(key, JSON.stringify(newPrefs));
    } catch {
      // Storage unavailable or quota exceeded
    }
  },
  loadPrefs: (userId) => {
    const key = getDbKey(userId ?? get().userId);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ReaderPrefs>;
        set({ prefs: { ...DEFAULT_PREFS, ...parsed } });
      }
    } catch {
      // Fallback to defaults
    }
  },
}));

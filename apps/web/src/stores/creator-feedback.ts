import { create } from 'zustand';
import type {
  CreatorBook,
  Disposition,
} from '../lib/api/creator';
import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '../lib/api/feedback';

interface CreatorState {
  books: CreatorBook[];
  booksLoaded: boolean;
  selectedBookId: string | null;
  items: FeedbackItem[];
  statusFilter: FeedbackStatus | null;
  categoryFilter: FeedbackCategory | null;
  selectedId: string | null;
  isLoading: boolean;
  error: string | null;
  setBooks: (books: CreatorBook[]) => void;
  selectBook: (bookId: string | null) => void;
  setItems: (items: FeedbackItem[]) => void;
  upsertItem: (item: FeedbackItem) => void;
  setStatusFilter: (status: FeedbackStatus | null) => void;
  setCategoryFilter: (category: FeedbackCategory | null) => void;
  selectItem: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetWorkspace: () => void;
}

export type { Disposition };

export const useCreatorStore = create<CreatorState>()((set) => ({
  books: [],
  booksLoaded: false,
  selectedBookId: null,
  items: [],
  statusFilter: null,
  categoryFilter: null,
  selectedId: null,
  isLoading: false,
  error: null,
  setBooks: (books) => set({ books, booksLoaded: true }),
  selectBook: (bookId) =>
    set({ selectedBookId: bookId, items: [], selectedId: null, error: null }),
  setItems: (items) => set({ items }),
  upsertItem: (item) =>
    set((state) => {
      const rest = state.items.filter((f) => f.id !== item.id);
      return { items: [...rest, item] };
    }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  selectItem: (selectedId) => set({ selectedId }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  resetWorkspace: () =>
    set({ items: [], selectedId: null, statusFilter: null, categoryFilter: null, error: null }),
}));

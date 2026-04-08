import { create } from 'zustand';

export interface Locator {
  cfi?: string;
  selectedText?: string;
  chapterRef?: string;
  elementIndex?: number;
  charOffset?: number;
}

export interface ReadingProgress {
  locator: Locator | null;
  progressPercent: number;
  updatedAt: string | null;
}

export interface Bookmark {
  id: string;
  locator: Locator;
  label: string | null;
  createdAt: string;
}

export interface Highlight {
  id: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string;
  note: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  userEmail: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string | null;
  body: string;
  status: 'open' | 'resolved' | 'deleted';
  visibility: 'shared' | 'internal' | 'resolved';
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  replies?: Comment[];
}

interface ReaderState {
  progress: ReadingProgress;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  comments: Comment[];
  currentChapter: string | null;
  isLoading: boolean;
  error: string | null;
  setProgress: (progress: ReadingProgress) => void;
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (id: string) => void;
  setBookmarks: (bookmarks: Bookmark[]) => void;
  addHighlight: (highlight: Highlight) => void;
  removeHighlight: (id: string) => void;
  setHighlights: (highlights: Highlight[]) => void;
  addComment: (comment: Comment) => void;
  updateComment: (id: string, updates: Partial<Comment>) => void;
  setComments: (comments: Comment[]) => void;
  setCurrentChapter: (chapter: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  progress: { locator: null, progressPercent: 0, updatedAt: null },
  bookmarks: [],
  highlights: [],
  comments: [],
  currentChapter: null,
  isLoading: false,
  error: null,
  setProgress: (progress) => set({ progress }),
  addBookmark: (bookmark) =>
    set((state) => ({ bookmarks: [bookmark, ...state.bookmarks] })),
  removeBookmark: (id) =>
    set((state) => ({ bookmarks: state.bookmarks.filter((b) => b.id !== id) })),
  setBookmarks: (bookmarks) => set({ bookmarks }),
  addHighlight: (highlight) =>
    set((state) => ({ highlights: [highlight, ...state.highlights] })),
  removeHighlight: (id) =>
    set((state) => ({ highlights: state.highlights.filter((h) => h.id !== id) })),
  setHighlights: (highlights) => set({ highlights }),
  addComment: (comment) =>
    set((state) => {
      if (comment.parentCommentId) {
        const addReply = (comments: Comment[]): Comment[] =>
          comments.map((c) =>
            c.id === comment.parentCommentId
              ? { ...c, replies: [...(c.replies || []), comment] }
              : { ...c, replies: addReply(c.replies || []) }
          );
        return { comments: addReply(state.comments) };
      }
      return { comments: [...state.comments, comment] };
    }),
  updateComment: (id, updates) =>
    set((state) => {
      const update = (comments: Comment[]): Comment[] =>
        comments.map((c) =>
          c.id === id ? { ...c, ...updates } : { ...c, replies: update(c.replies || []) }
        );
      return { comments: update(state.comments) };
    }),
  setComments: (comments) => set({ comments }),
  setCurrentChapter: (chapter) => set({ currentChapter: chapter }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

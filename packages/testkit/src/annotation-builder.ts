export interface CommentBuilder {
  build(): {
    id: string;
    bookId: string;
    userEmail: string;
    chapterRef: string | null;
    cfiRange: string | null;
    selectedText: string | null;
    body: string;
    status: string;
    visibility: string;
    parentCommentId: string | null;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
  };
  withBody(body: string): CommentBuilder;
  withStatus(status: string): CommentBuilder;
  withCfi(cfi: string): CommentBuilder;
  withParent(parentId: string): CommentBuilder;
  withResolved(): CommentBuilder;
}

export interface HighlightBuilder {
  build(): {
    id: string;
    bookId: string;
    userEmail: string;
    chapterRef: string | null;
    cfiRange: string | null;
    selectedText: string;
    note: string | null;
    color: string;
    createdAt: string;
    updatedAt: string;
  };
  withText(text: string): HighlightBuilder;
  withCfi(cfi: string): HighlightBuilder;
  withColor(color: string): HighlightBuilder;
  withNote(note: string): HighlightBuilder;
}

export interface BookmarkBuilder {
  build(): {
    id: string;
    bookId: string;
    userEmail: string;
    locatorJson: string;
    label: string | null;
    createdAt: string;
  };
  withLabel(label: string): BookmarkBuilder;
  withLocator(locator: object): BookmarkBuilder;
}

interface CommentState {
  id: string;
  bookId: string;
  userEmail: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string | null;
  body: string;
  status: string;
  visibility: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export function createCommentBuilder(): CommentBuilder {
  let state: CommentState = {
    id: crypto.randomUUID(),
    bookId: crypto.randomUUID(),
    userEmail: 'reviewer@example.com',
    chapterRef: null,
    cfiRange: null,
    selectedText: null,
    body: 'Test comment',
    status: 'open',
    visibility: 'shared',
    parentCommentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
  };

  const self: CommentBuilder = {
    build: () => ({ ...state }),
    withBody: (body: string) => {
      state = { ...state, body };
      return self;
    },
    withStatus: (status: string) => {
      state = { ...state, status };
      return self;
    },
    withCfi: (cfi: string) => {
      state = { ...state, cfiRange: cfi };
      return self;
    },
    withParent: (parentId: string) => {
      state = { ...state, parentCommentId: parentId };
      return self;
    },
    withResolved: () => {
      state = { ...state, status: 'resolved', resolvedAt: new Date().toISOString() };
      return self;
    },
  };

  return self;
}

interface HighlightState {
  id: string;
  bookId: string;
  userEmail: string;
  chapterRef: string | null;
  cfiRange: string | null;
  selectedText: string;
  note: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export function createHighlightBuilder(): HighlightBuilder {
  let state: HighlightState = {
    id: crypto.randomUUID(),
    bookId: crypto.randomUUID(),
    userEmail: 'reader@example.com',
    chapterRef: null,
    cfiRange: null,
    selectedText: 'Selected text from book',
    note: null,
    color: '#ffff00',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const self: HighlightBuilder = {
    build: () => ({ ...state }),
    withText: (text: string) => {
      state = { ...state, selectedText: text };
      return self;
    },
    withCfi: (cfi: string) => {
      state = { ...state, cfiRange: cfi };
      return self;
    },
    withColor: (color: string) => {
      state = { ...state, color };
      return self;
    },
    withNote: (note: string) => {
      state = { ...state, note };
      return self;
    },
  };

  return self;
}

interface BookmarkState {
  id: string;
  bookId: string;
  userEmail: string;
  locatorJson: string;
  label: string | null;
  createdAt: string;
}

export function createBookmarkBuilder(): BookmarkBuilder {
  let state: BookmarkState = {
    id: crypto.randomUUID(),
    bookId: crypto.randomUUID(),
    userEmail: 'reader@example.com',
    locatorJson: JSON.stringify({ cfi: 'epubcfi(/6/4[chap01]!/4/2/1:0)' }),
    label: null,
    createdAt: new Date().toISOString(),
  };

  const self: BookmarkBuilder = {
    build: () => ({ ...state }),
    withLabel: (label: string) => {
      state = { ...state, label };
      return self;
    },
    withLocator: (locator: object) => {
      state = { ...state, locatorJson: JSON.stringify(locator) };
      return self;
    },
  };

  return self;
}

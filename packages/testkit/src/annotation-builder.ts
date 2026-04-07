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

export function createCommentBuilder(): CommentBuilder {
  const state = {
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

  return {
    build: () => ({ ...state }),
    withBody: (body: string) => {
      state.body = body;
      return createCommentBuilder().withBody(body);
    },
    withStatus: (status: string) => {
      state.status = status;
      return createCommentBuilder().withStatus(status);
    },
    withCfi: (cfi: string) => {
      state.cfiRange = cfi;
      return createCommentBuilder().withCfi(cfi);
    },
    withParent: (parentId: string) => {
      state.parentCommentId = parentId;
      return createCommentBuilder().withParent(parentId);
    },
    withResolved: () => {
      state.status = 'resolved';
      state.resolvedAt = new Date().toISOString();
      return createCommentBuilder().withResolved();
    },
  };
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

export function createHighlightBuilder(): HighlightBuilder {
  const state = {
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

  return {
    build: () => ({ ...state }),
    withText: (text: string) => {
      state.selectedText = text;
      return createHighlightBuilder().withText(text);
    },
    withCfi: (cfi: string) => {
      state.cfiRange = cfi;
      return createHighlightBuilder().withCfi(cfi);
    },
    withColor: (color: string) => {
      state.color = color;
      return createHighlightBuilder().withColor(color);
    },
    withNote: (note: string) => {
      state.note = note;
      return createHighlightBuilder().withNote(note);
    },
  };
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

export function createBookmarkBuilder(): BookmarkBuilder {
  const state = {
    id: crypto.randomUUID(),
    bookId: crypto.randomUUID(),
    userEmail: 'reader@example.com',
    locatorJson: JSON.stringify({ cfi: 'epubcfi(/6/4[chap01]!/4/2/1:0)' }),
    label: null,
    createdAt: new Date().toISOString(),
  };

  return {
    build: () => ({ ...state }),
    withLabel: (label: string) => {
      state.label = label;
      return createBookmarkBuilder().withLabel(label);
    },
    withLocator: (locator: object) => {
      state.locatorJson = JSON.stringify(locator);
      return createBookmarkBuilder().withLocator(locator);
    },
  };
}

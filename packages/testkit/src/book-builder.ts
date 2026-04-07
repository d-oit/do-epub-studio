export interface BookBuilder {
  build(): {
    id: string;
    slug: string;
    title: string;
    authorName: string | null;
    description: string | null;
    language: string;
    visibility: string;
    coverImageUrl: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
  };
  withTitle(title: string): BookBuilder;
  withSlug(slug: string): BookBuilder;
  withVisibility(visibility: string): BookBuilder;
}

export function createBookBuilder(): BookBuilder {
  const state = {
    id: crypto.randomUUID(),
    slug: 'test-book',
    title: 'Test Book',
    authorName: 'Test Author',
    description: null,
    language: 'en',
    visibility: 'private',
    coverImageUrl: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  };

  return {
    build: () => ({ ...state }),
    withTitle: (title: string) => {
      state.title = title;
      return createBookBuilder().withTitle(title);
    },
    withSlug: (slug: string) => {
      state.slug = slug;
      return createBookBuilder().withSlug(slug);
    },
    withVisibility: (visibility: string) => {
      state.visibility = visibility;
      return createBookBuilder().withVisibility(visibility);
    },
  };
}

export interface BookFileBuilder {
  build(): {
    id: string;
    bookId: string;
    storageProvider: string;
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    sha256: string | null;
    epubVersion: string | null;
    manifestJson: string | null;
    createdAt: string;
  };
}

export function createBookFileBuilder(): BookFileBuilder {
  const bookId = crypto.randomUUID();
  return {
    build: () => ({
      id: crypto.randomUUID(),
      bookId,
      storageProvider: 'r2',
      storageKey: `books/${bookId}/epub/file.epub`,
      originalFilename: 'test.epub',
      mimeType: 'application/epub+zip',
      fileSizeBytes: 1024 * 100,
      sha256: null,
      epubVersion: '3.0',
      manifestJson: null,
      createdAt: new Date().toISOString(),
    }),
  };
}

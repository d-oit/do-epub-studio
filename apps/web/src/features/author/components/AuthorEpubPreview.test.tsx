import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { AuthorAssetMetadata, AuthorPublication } from '@do-epub-studio/shared';
import { usePreferencesStore } from '../../../stores';
import { AuthorEpubPreview } from './AuthorEpubPreview';

const mocks = vi.hoisted(() => ({
  createEpubLoader: vi.fn(),
  fetchAuthorAsset: vi.fn(),
  applyTheme: vi.fn(),
  applyDirectionToContents: vi.fn(),
  translate: (key: string) => (key === 'author.preview.next' ? 'Next page' : key),
}));

vi.mock('@do-epub-studio/reader-core', () => ({
  createEpubLoader: mocks.createEpubLoader,
}));

vi.mock('../../../lib/api/author-assets', () => ({
  fetchAuthorAsset: mocks.fetchAuthorAsset,
}));

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mocks.translate }),
}));

vi.mock('../../reader/hooks/useReaderEpub.helpers', () => ({
  createThemeApplier: () => mocks.applyTheme,
}));

vi.mock('../../reader/lib/epub-init', () => ({
  applyDirectionToContents: mocks.applyDirectionToContents,
}));

class TestResizeObserver {
  static instances: TestResizeObserver[] = [];

  constructor(private readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this);
  }

  observe = vi.fn();
  disconnect = vi.fn();

  trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}
const IMAGE_ID = '11111111-1111-4111-8111-111111111111';
const COVER_ID = '22222222-2222-4222-8222-222222222222';
const STYLESHEET_ID = '33333333-3333-4333-8333-333333333333';
const UNUSED_ID = '44444444-4444-4444-8444-444444444444';

function asset(
  id: string,
  name: string,
  mediaType: AuthorAssetMetadata['mediaType'],
): AuthorAssetMetadata {
  return {
    id,
    name,
    mediaType,
    sizeBytes: 32,
    sha256: 'a'.repeat(64),
    createdAt: '2026-11-05T12:00:00.000Z',
  };
}

const publication: AuthorPublication = {
  title: 'Preview fidelity',
  creators: ['Author'],
  language: 'en',
  identifier: 'urn:uuid:preview-fidelity',
  description: '',
  publisher: '',
  rights: '',
  coverImageAssetId: COVER_ID,
  stylesheetAssetIds: [STYLESHEET_ID],
  chapters: [
    {
      id: 'ch-1',
      title: 'Chapter 1',
      order: 0,
      contentHtml: `<p>Visible chapter text</p><img src="asset:${IMAGE_ID}" alt="Diagram">`,
    },
  ],
};

const assets = [
  asset(IMAGE_ID, 'diagram.png', 'image/png'),
  asset(COVER_ID, 'cover.png', 'image/png'),
  asset(STYLESHEET_ID, 'book.css', 'text/css'),
  asset(UNUSED_ID, 'unused.png', 'image/png'),
];

function createRenditionMock(overrides: Record<string, unknown> = {}) {
  return {
    display: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    prev: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
    resize: vi.fn(),
    contents: {
      current: null,
      select: vi.fn(),
      registerRules: vi.fn(),
    },
    getContents: vi.fn((): unknown[] => []),
    registerContentHook: vi.fn(),
    registerRenderHook: vi.fn(),
    ...overrides,
  };
}

function createLoaderMock(rendition: ReturnType<typeof createRenditionMock>) {
  return {
    load: vi.fn().mockResolvedValue(undefined),
    createRendition: vi.fn(() => rendition),
    destroy: vi.fn(),
  };
}

function stubAssetFetches() {
  mocks.fetchAuthorAsset.mockImplementation(
    (_bookId: string, authorAsset: Pick<AuthorAssetMetadata, 'id' | 'mediaType'>) => {
      if (authorAsset.id === UNUSED_ID) {
        return Promise.reject(new Error('Unused asset is unavailable'));
      }
      const data =
        authorAsset.mediaType === 'text/css'
          ? 'p { color: #123; }'
          : new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      return Promise.resolve(new Blob([data], { type: authorAsset.mediaType }));
    },
  );
}

describe('AuthorEpubPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TestResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    usePreferencesStore.setState({
      reader: {
        theme: 'system',
        fontFamily: 'serif',
        fontSize: 'medium',
        lineHeight: 2,
        pageWidth: 'normal',
        direction: 'default',
        writingMode: 'horizontal-tb',
        aiEnabled: false,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('previews referenced assets without fetching an unavailable unused asset', async () => {
    const rendition = createRenditionMock();
    const loader = createLoaderMock(rendition);
    mocks.createEpubLoader.mockReturnValue(loader);
    stubAssetFetches();

    render(
      <AuthorEpubPreview
        bookId="book-1"
        publication={publication}
        assets={assets}
        updatedAt="2026-11-05T12:00:00.000Z"
      />,
    );

    const nextButton = await screen.findByRole('button', { name: 'Next page' });
    await waitFor(() => expect(nextButton).toBeEnabled());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      mocks.fetchAuthorAsset.mock.calls.map(([, authorAsset]) => authorAsset.id).sort(),
    ).toEqual([IMAGE_ID, COVER_ID, STYLESHEET_ID].sort());
    expect(loader.load).toHaveBeenCalledOnce();
    expect(rendition.display).toHaveBeenCalledOnce();
  });

  it('applies the reader theme and direction to the rendered rendition', async () => {
    const rendition = createRenditionMock();
    const loader = createLoaderMock(rendition);
    mocks.createEpubLoader.mockReturnValue(loader);
    stubAssetFetches();

    render(
      <AuthorEpubPreview
        bookId="book-1"
        publication={publication}
        assets={assets}
        updatedAt="2026-11-05T12:00:00.000Z"
      />,
    );

    const nextButton = await screen.findByRole('button', { name: 'Next page' });
    await waitFor(() => expect(nextButton).toBeEnabled());

    expect(mocks.applyTheme).toHaveBeenCalledWith(rendition);
    expect(rendition.registerContentHook).toHaveBeenCalledOnce();
    // Default direction resolves to ltr for English with no explicit override.
    const contentHook = rendition.registerContentHook.mock.calls[0]?.[0] as
      ((contents: unknown) => void) | undefined;
    expect(contentHook).toBeTypeOf('function');
    contentHook?.({});
    expect(mocks.applyDirectionToContents).toHaveBeenCalledWith({}, 'ltr');
  });

  it('re-applies theme and direction when reader preferences change without reloading', async () => {
    const rendition = createRenditionMock();
    const loader = createLoaderMock(rendition);
    mocks.createEpubLoader.mockReturnValue(loader);
    stubAssetFetches();

    render(
      <AuthorEpubPreview
        bookId="book-1"
        publication={publication}
        assets={assets}
        updatedAt="2026-11-05T12:00:00.000Z"
      />,
    );

    const nextButton = await screen.findByRole('button', { name: 'Next page' });
    await waitFor(() => expect(nextButton).toBeEnabled());
    const applyCallsAfterLoad = mocks.applyTheme.mock.calls.length;
    expect(applyCallsAfterLoad).toBeGreaterThan(0);

    const openContents = [{ document: null }];
    rendition.getContents.mockReturnValue(openContents);

    act(() => {
      usePreferencesStore.setState({
        reader: { ...usePreferencesStore.getState().reader, theme: 'dark', direction: 'rtl' },
      });
    });

    expect(mocks.applyTheme.mock.calls.length).toBeGreaterThan(applyCallsAfterLoad);
    expect(mocks.applyDirectionToContents).toHaveBeenCalledWith(openContents[0], 'rtl');
    expect(loader.load).toHaveBeenCalledOnce();
    expect(rendition.display).toHaveBeenCalledOnce();
  });

  it('resizes the displayed rendition when the preview container changes size', async () => {
    let displayedListener: (() => void) | undefined;
    const rendition = createRenditionMock({
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'displayed') displayedListener = callback;
      }),
    });
    const loader = {
      load: vi.fn().mockResolvedValue(undefined),
      createRendition: vi.fn((container: HTMLElement) => {
        container.appendChild(document.createElement('iframe'));
        return rendition;
      }),
      destroy: vi.fn(),
    };
    mocks.createEpubLoader.mockReturnValue(loader);
    stubAssetFetches();

    render(
      <AuthorEpubPreview
        bookId="book-1"
        publication={publication}
        assets={assets}
        updatedAt="2026-11-05T12:00:00.000Z"
      />,
    );
    const nextButton = await screen.findByRole('button', { name: 'Next page' });
    await waitFor(() => expect(nextButton).toBeEnabled());

    const container = screen.getByTestId('author-epub-preview').firstElementChild as HTMLElement;
    Object.defineProperties(container, {
      clientWidth: { configurable: true, value: 356 },
      clientHeight: { configurable: true, value: 572 },
    });
    const observer = TestResizeObserver.instances.at(-1);
    if (!observer) throw new Error('expected the preview resize observer');
    observer.trigger();
    observer.trigger();

    expect(rendition.resize).toHaveBeenCalledOnce();
    expect(rendition.resize).toHaveBeenCalledWith(356, 572);
    const initialIframe = container.querySelector('iframe');
    expect(initialIframe).toHaveAttribute('title', 'author.preview.frameLabel');
    const replacementIframe = document.createElement('iframe');
    initialIframe?.replaceWith(replacementIframe);
    displayedListener?.();
    expect(replacementIframe).toHaveAttribute('title', 'author.preview.frameLabel');
  });
});

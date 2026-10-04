import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type * as ReaderCore from '@do-epub-studio/reader-core';
import { AssistancePanel } from './AssistancePanel';
import {
  fetchAssistanceConsent,
  fetchReferences,
  fetchStyleProfile,
  setAssistanceConsent,
} from '../../lib/api/creator';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector: (s: { sessionToken: string }) => unknown) =>
    selector({ sessionToken: 'token' }),
}));

vi.mock('../../lib/api/creator', () => ({
  fetchAssistanceConsent: vi.fn(),
  setAssistanceConsent: vi.fn(),
  fetchReferences: vi.fn(),
  fetchStyleProfile: vi.fn(),
}));

/**
 * The book loader is stubbed so tests never parse a real EPUB; the grounding
 * path (file-url → chapters → extraction) is exercised at the hook/panel
 * boundary here and in book-chapters.test.ts.
 */
const chaptersStub = vi.hoisted(() => ({
  fetchBookFileUrl: vi.fn(),
  loadCreatorBook: vi.fn(),
}));

vi.mock('./lib/book-chapters', () => ({
  fetchBookFileUrl: chaptersStub.fetchBookFileUrl,
  loadCreatorBook: chaptersStub.loadCreatorBook,
}));

/**
 * B1: the Transformers.js engine is stubbed so clicking prepare can never
 * trigger a real model download in CI — the panel stays fully offline-testable.
 */
const transformersStub = vi.hoisted(() => ({
  load: vi.fn(),
  review: vi.fn(),
  hasEngine: vi.fn((): boolean => false),
}));

vi.mock('@do-epub-studio/reader-core', async (importOriginal) => {
  const actual = await importOriginal<typeof ReaderCore>();
  return {
    ...actual,
    createTransformersEditorialPlugin: () => ({
      id: 'transformers-editorial',
      title: 'stub',
      version: '0.1.0',
      capabilities: {
        editorial: {
          kind: 'editorial',
          model: 'stub-model',
          dtype: 'q8',
          device: null,
          hasEngine: transformersStub.hasEngine,
          load: transformersStub.load,
          review: transformersStub.review,
        },
      },
    }),
  };
});

describe('AssistancePanel (Wave 4, synthetic fixtures for consent/UI paths)', () => {
  beforeEach(() => {
    transformersStub.hasEngine.mockReturnValue(false);
    transformersStub.load.mockReset();
    transformersStub.review.mockReset();
    chaptersStub.fetchBookFileUrl.mockReset();
    chaptersStub.loadCreatorBook.mockReset();
    vi.mocked(fetchReferences).mockReset().mockResolvedValue([]);
    vi.mocked(fetchStyleProfile).mockReset().mockResolvedValue(null);
  });

  it('lists all four categories as unavailable while no engine is qualified', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    for (const key of ['asst.catSpelling', 'asst.catGrammar', 'asst.catStory', 'asst.catLogic']) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
    // Every category reports the missing engine; none claims availability.
    await waitFor(() => {
      expect(screen.getAllByText('asst.engineMissing').length).toBeGreaterThanOrEqual(4);
    });
  });

  it('reports the missing engine when a check runs, never "no findings"', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'asst.runLabel' }));

    await waitFor(() => {
      expect(screen.getByText('asst.unavailable')).toBeInTheDocument();
    });
    // The dishonest outcome would read as a clean run.
    expect(screen.queryByText('asst.noFindings')).not.toBeInTheDocument();
  });

  it('shows cloud consent off by default and dispatch disabled as unqualified', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    const toggle = await screen.findByRole('checkbox');
    expect(toggle).not.toBeChecked();
    // The consent labels render from a second state update (the fetch result
    // lands after the checkbox exists), so they must be awaited too — a sync
    // getByText here raced that update and flaked under CI load.
    expect(await screen.findByText('asst.cloudConsentOff')).toBeInTheDocument();
    expect(await screen.findByText('asst.cloudNotQualified')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'asst.dispatch' })).not.toBeInTheDocument();
  });

  it('keeps dispatch disabled even after consent is granted', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });
    // The server still reports cloudQualified false; consent cannot imply it.
    vi.mocked(setAssistanceConsent).mockResolvedValue({ allowed: true, cloudQualified: false });

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('checkbox'));

    await waitFor(() => {
      expect(vi.mocked(setAssistanceConsent)).toHaveBeenCalledWith('book-1', true, 'token');
    });
    expect(await screen.findByRole('checkbox')).toBeChecked();
    expect(screen.getByText('asst.cloudNotQualified')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'asst.dispatch' })).not.toBeInTheDocument();
  });

  it('prepares the story/logic engine via a labelled download with visible progress', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });
    // Controllable load: emit real-shaped progress, resolve only when the test says so.
    let settle: (state: unknown) => void = () => undefined;
    transformersStub.load.mockImplementation(
      (onProgress?: (progress: unknown) => void): Promise<unknown> => {
        onProgress?.({
          phase: 'download',
          file: 'onnx/model_quantized.onnx',
          loadedBytes: 244,
          totalBytes: 488,
          percent: 50,
        });
        return new Promise((resolve) => {
          settle = resolve;
        });
      },
    );

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'asst.enginePrepare' }));

    // Labelled download state: percent text + progressbar carrying the value.
    await waitFor(() => {
      expect(screen.getByText('asst.engineDownloading')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    });
    expect(screen.getByText('asst.engineNote')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'asst.enginePrepare' })).not.toBeInTheDocument();

    // Labelled load resolves → ready replaces the control, one load call only.
    settle({ loaded: true, device: 'cpu', model: 'stub-model' });
    await waitFor(() => {
      expect(screen.getByText('asst.engineReady')).toBeInTheDocument();
    });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(transformersStub.load).toHaveBeenCalledTimes(1);
  });

  it('loads chapters through read access, then dispatches a grounded request', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });
    const destroy = vi.fn();
    const extract = vi.fn(() =>
      Promise.resolve({
        chapterText: { 'c1.xhtml': 'Once upon a time.' },
        chapterSha256: { 'c1.xhtml': 'sha256:x' },
      }),
    );
    chaptersStub.fetchBookFileUrl.mockResolvedValue({ url: 'signed-url', fileId: 'file-1' });
    chaptersStub.loadCreatorBook.mockResolvedValue({
      chapters: [
        { ref: 'c1.xhtml', title: 'One', index: 0 },
        { ref: 'c2.xhtml', title: 'Two', index: 1 },
      ],
      language: 'en',
      extract,
      destroy,
    });
    vi.mocked(fetchReferences).mockResolvedValue([
      {
        id: 'ref-1',
        kind: 'glossary_term',
        title: 'Mariselleth',
        content: 'A coinage.',
        attribution: null,
        sourceUrl: null,
        origin: 'creator',
        verified: true,
        revision: 2,
        createdBy: 'user-1',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(fetchStyleProfile).mockResolvedValue({
      language: 'English (British)',
      narrativePerson: null,
      tense: null,
      dialogueConventions: null,
      dialectNotes: null,
      terminology: 'Mariselleth',
      intentionalExceptions: '',
      status: 'approved',
      approvedBy: 'user-1',
      approvedAt: '2026-09-01T00:00:00.000Z',
      revision: 4,
    });
    transformersStub.hasEngine.mockReturnValue(true);
    transformersStub.review.mockResolvedValue({ status: 'no_supported_findings' });

    const { unmount } = render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'asst.loadChapters' }));
    await screen.findByText('One');
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(extract).not.toHaveBeenCalled();
    expect(chaptersStub.fetchBookFileUrl).toHaveBeenCalledWith('book-1', 'token');

    fireEvent.click(screen.getByRole('button', { name: 'asst.runLabel' }));
    await waitFor(() => {
      expect(transformersStub.review).toHaveBeenCalledTimes(1);
    });
    expect(extract).toHaveBeenCalledWith(['c1.xhtml']);
    expect(transformersStub.review.mock.calls[0]?.[0]).toMatchObject({
      categories: ['story', 'logic'],
      chapterText: { 'c1.xhtml': 'Once upon a time.' },
      chapterSha256: { 'c1.xhtml': 'sha256:x' },
      references: { 'ref-1': { revision: 2, content: 'A coinage.' } },
      styleRevision: 4,
      language: 'en',
      approvedTerms: ['Mariselleth'],
    });
    expect(await screen.findByText('asst.noFindings')).toBeInTheDocument();

    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('reports missing read access honestly instead of extracting', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });
    chaptersStub.fetchBookFileUrl.mockRejectedValue(
      Object.assign(new Error('Book not found'), { status: 404 }),
    );

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'asst.loadChapters' }));
    expect(await screen.findByText('asst.noReadAccess')).toBeInTheDocument();
    expect(chaptersStub.loadCreatorBook).not.toHaveBeenCalled();
  });

  it('offers a retry when loading the book text fails, and recovers', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });
    chaptersStub.fetchBookFileUrl.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { status: 500 }),
    );
    chaptersStub.fetchBookFileUrl.mockResolvedValueOnce({ url: 'signed-url', fileId: 'file-1' });
    chaptersStub.loadCreatorBook.mockResolvedValue({
      chapters: [{ ref: 'c1.xhtml', title: 'One', index: 0 }],
      language: null,
      extract: vi.fn(() => Promise.resolve({ chapterText: {}, chapterSha256: {} })),
      destroy: vi.fn(),
    });

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'asst.loadChapters' }));
    expect(await screen.findByText('asst.loadFailed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'asst.loadChapters' }));
    expect(await screen.findByText('One')).toBeInTheDocument();
    expect(chaptersStub.fetchBookFileUrl).toHaveBeenCalledTimes(2);
  });

  it('tells the reviewer to load text when an engine is present but nothing is grounded', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });
    transformersStub.hasEngine.mockReturnValue(true);

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'asst.runLabel' }));
    expect(await screen.findByText('asst.textRequired')).toBeInTheDocument();
    expect(transformersStub.review).not.toHaveBeenCalled();
  });
});

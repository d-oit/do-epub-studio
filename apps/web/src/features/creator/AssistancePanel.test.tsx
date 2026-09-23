import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssistancePanel } from './AssistancePanel';
import { fetchAssistanceConsent, setAssistanceConsent } from '../../lib/api/creator';

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
  const actual = await importOriginal<typeof import('@do-epub-studio/reader-core')>();
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
    expect(screen.getByText('asst.cloudConsentOff')).toBeInTheDocument();
    expect(screen.getByText('asst.cloudNotQualified')).toBeInTheDocument();
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
});

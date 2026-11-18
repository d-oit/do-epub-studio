import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExportNotesPanel } from './ExportNotesPanel';
import { useAuthStore } from '../../../stores/auth';
import { useReaderStore } from '../../../stores/reader';
import type * as UseExportNotesModule from '../hooks/useExportNotes';

const { mockHandleExportNotes } = vi.hoisted(() => ({
  mockHandleExportNotes: vi.fn(),
}));
const { mockFetchAnnotationExport } = vi.hoisted(() => ({
  mockFetchAnnotationExport: vi.fn(),
}));

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
vi.mock('../hooks/useExportNotes', async (importOriginal) => {
  const actual = await importOriginal<typeof UseExportNotesModule>();
  return {
    ...actual,
    useExportNotes: () => ({ handleExportNotes: mockHandleExportNotes }),
  };
});
vi.mock('../../../lib/api/annotation-export', () => ({
  fetchAnnotationExport: mockFetchAnnotationExport,
}));

const objectUrls = {
  createObjectURL: vi.fn(() => 'blob:annotation-export'),
  revokeObjectURL: vi.fn(),
};
const downloads: string[] = [];

function renderPanel(onClose = vi.fn()) {
  render(<ExportNotesPanel onClose={onClose} />);
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  downloads.length = 0;
  // act(): a previous test's panel may still subscribe to these stores because
  // RTL cleanup registers before this file's hooks and runs after them.
  act(() => {
    useAuthStore.setState({
      bookId: 'book-1',
      bookTitle: 'My Book',
      sessionToken: 'reader-token',
    });
    useReaderStore.setState({ isOffline: false });
  });
  vi.stubGlobal('URL', objectUrls);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  act(() => {
    useReaderStore.setState({ isOffline: false });
  });
});

describe('ExportNotesPanel', () => {
  it('renders a dialog with Markdown selected by default', () => {
    renderPanel();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('id', 'reader-export-panel');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const select = screen.getByLabelText<HTMLSelectElement>('reader.export.formatLabel');
    expect(select.value).toBe('markdown');
    expect(screen.getByRole('button', { name: 'reader.export.download' })).toBeEnabled();
  });

  it('keeps Markdown selectable while disabling online formats offline', () => {
    act(() => {
      useReaderStore.setState({ isOffline: true });
    });
    renderPanel();
    const select = screen.getByLabelText<HTMLSelectElement>('reader.export.formatLabel');
    const htmlOption = select.querySelector<HTMLOptionElement>('option[value="html"]');
    const epubOption = select.querySelector<HTMLOptionElement>('option[value="epub"]');
    expect(htmlOption?.disabled).toBe(true);
    expect(epubOption?.disabled).toBe(true);
    expect(select.querySelector<HTMLOptionElement>('option[value="markdown"]')?.disabled).toBe(
      false,
    );
    expect(screen.getByText('reader.export.onlineRequired')).toBeInTheDocument();
    expect(select).toHaveAttribute('aria-describedby');
  });

  it('downloads Markdown client-side and closes the panel', async () => {
    mockHandleExportNotes.mockResolvedValue(undefined);
    const onClose = renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'reader.export.download' }));
      await Promise.resolve();
    });
    expect(mockHandleExportNotes).toHaveBeenCalledWith('My Book');
    expect(mockFetchAnnotationExport).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not offer cancellation for local Markdown export', async () => {
    let resolveExport: (() => void) | undefined;
    mockHandleExportNotes.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveExport = resolve;
        }),
    );
    renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'reader.export.download' }));
      await Promise.resolve();
    });

    expect(screen.getByText('reader.export.downloading')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'reader.export.cancel' })).not.toBeInTheDocument();

    await act(async () => {
      resolveExport?.();
      await Promise.resolve();
    });
  });

  it('requests an EPUB export and downloads the returned blob', async () => {
    mockFetchAnnotationExport.mockResolvedValue(
      new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], {
        type: 'application/epub+zip',
      }),
    );
    const onClose = renderPanel();
    act(() => {
      fireEvent.change(screen.getByLabelText('reader.export.formatLabel'), {
        target: { value: 'epub' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'reader.export.download' }));
      await Promise.resolve();
    });
    expect(mockFetchAnnotationExport).toHaveBeenCalledWith(
      'book-1',
      'epub',
      'reader-token',
      expect.any(AbortSignal),
    );
    expect(downloads).toEqual(['My Book-notes.epub']);
    expect(objectUrls.revokeObjectURL).toHaveBeenCalledWith('blob:annotation-export');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('requests an HTML export and downloads the returned blob', async () => {
    mockFetchAnnotationExport.mockResolvedValue(
      new Blob(['<html>Notes</html>'], { type: 'text/html;charset=utf-8' }),
    );
    const onClose = renderPanel();
    act(() => {
      fireEvent.change(screen.getByLabelText('reader.export.formatLabel'), {
        target: { value: 'html' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'reader.export.download' }));
      await Promise.resolve();
    });
    expect(mockFetchAnnotationExport).toHaveBeenCalledWith(
      'book-1',
      'html',
      'reader-token',
      expect.any(AbortSignal),
    );
    expect(downloads).toEqual(['My Book-notes.html']);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not request online formats without a session', () => {
    useAuthStore.setState({ sessionToken: null });
    renderPanel();
    const select = screen.getByLabelText<HTMLSelectElement>('reader.export.formatLabel');
    expect(select.querySelector<HTMLOptionElement>('option[value="html"]')?.disabled).toBe(true);
    expect(select.querySelector<HTMLOptionElement>('option[value="epub"]')?.disabled).toBe(true);
  });

  it('reports an inline error and stays open when an online export fails', async () => {
    mockFetchAnnotationExport.mockRejectedValue(new Error('Network error'));
    const onClose = renderPanel();
    act(() => {
      fireEvent.change(screen.getByLabelText('reader.export.formatLabel'), {
        target: { value: 'epub' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'reader.export.download' }));
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('reader.export.error');
    expect(onClose).not.toHaveBeenCalled();
    expect(downloads).toHaveLength(0);
  });

  it('lets the user cancel an in-flight export without stale busy state', async () => {
    const capturedSignal: { signal: AbortSignal | null } = { signal: null };
    mockFetchAnnotationExport.mockImplementation(
      (_bookId: string, _format: string, _token: string, signal?: AbortSignal) => {
        const { promise, reject } = Promise.withResolvers<Blob>();
        capturedSignal.signal = signal ?? null;
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        return promise;
      },
    );
    const onClose = renderPanel();
    act(() => {
      fireEvent.change(screen.getByLabelText('reader.export.formatLabel'), {
        target: { value: 'epub' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'reader.export.download' }));
      await Promise.resolve();
    });
    expect(screen.getByText('reader.export.downloading')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'reader.export.cancel' }));
      await Promise.resolve();
    });
    expect(capturedSignal.signal?.aborted).toBe(true);
    expect(screen.queryByText('reader.export.downloading')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'reader.export.download' })).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
    expect(downloads).toHaveLength(0);
  });

  it('does not download a response after the reader session changes', async () => {
    const capturedSignal: { signal: AbortSignal | null } = { signal: null };
    const resolveRequest: { current: ((blob: Blob) => void) | undefined } = { current: undefined };
    mockFetchAnnotationExport.mockImplementation(
      (_bookId: string, _format: string, _token: string, signal?: AbortSignal) => {
        capturedSignal.signal = signal ?? null;
        return new Promise<Blob>((resolve) => {
          resolveRequest.current = resolve;
        });
      },
    );
    const onClose = renderPanel();
    act(() => {
      fireEvent.change(screen.getByLabelText('reader.export.formatLabel'), {
        target: { value: 'epub' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'reader.export.download' }));
      await Promise.resolve();
    });

    act(() => {
      useAuthStore.setState({ sessionToken: null });
    });
    expect(capturedSignal.signal?.aborted).toBe(true);

    await act(async () => {
      resolveRequest.current?.(new Blob(['stale export'], { type: 'application/epub+zip' }));
      await Promise.resolve();
    });
    expect(objectUrls.createObjectURL).not.toHaveBeenCalled();
    expect(downloads).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('aborts an in-flight export on unmount', () => {
    const capturedSignal: { signal: AbortSignal | null } = { signal: null };
    mockFetchAnnotationExport.mockImplementation(
      (_bookId: string, _format: string, _token: string, signal?: AbortSignal) => {
        const { promise, reject } = Promise.withResolvers<Blob>();
        capturedSignal.signal = signal ?? null;
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        return promise;
      },
    );
    const { unmount } = render(<ExportNotesPanel onClose={vi.fn()} />);
    act(() => {
      fireEvent.change(screen.getByLabelText('reader.export.formatLabel'), {
        target: { value: 'epub' },
      });
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'reader.export.download' }));
    });
    unmount();
    expect(capturedSignal.signal?.aborted).toBe(true);
  });

  it('closes on Escape', () => {
    const onClose = renderPanel();
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

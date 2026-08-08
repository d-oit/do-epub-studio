import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImportNotes } from '../features/reader/hooks/useImportNotes';
import { importNotesFromMarkdown, type NotesImportResult } from '../features/reader/hooks/useExportNotes';

vi.mock('../features/reader/hooks/useExportNotes', () => ({
  importNotesFromMarkdown: vi.fn(),
}));

const mockSetHighlights = vi.fn();
const mockSetComments = vi.fn();
const mockSetBookmarks = vi.fn();

vi.mock('../stores', () => ({
  useReaderStore: vi.fn((selector) => {
    const state = {
      highlights: [{ id: 'h1', selectedText: 'existing', chapterRef: 'ch1', cfiRange: 'cfi1', color: '#ff0', note: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      comments: [{ id: 'c1', text: 'existing comment', chapterRef: 'ch1', status: 'open', createdAt: '2026-01-01', userEmail: 'user@test.com' }],
      bookmarks: [{ id: 'b1', label: 'existing bookmark', chapterRef: 'ch1', cfi: 'cfi1' }],
      setHighlights: mockSetHighlights,
      setComments: mockSetComments,
      setBookmarks: mockSetBookmarks,
    };
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  }),
}));

function createFile(content: string): File {
  return new File([content], 'notes.md', { type: 'text/markdown' });
}

describe('useImportNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges imported highlights with existing', async () => {
    vi.mocked(importNotesFromMarkdown).mockReturnValue({
      ok: true,
      highlights: [{ id: 'h2', selectedText: 'imported', chapterRef: 'ch2', cfiRange: 'cfi2', color: '#0f0', note: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      comments: [],
      bookmarks: [],
      skipped: 0,
      errors: [],
    });

    const { result } = renderHook(() => useImportNotes());
    const file = createFile('# Highlights\n- imported');

    await act(async () => {
      await result.current.handleImportNotes(file);
    });

    expect(mockSetHighlights).toHaveBeenCalledWith([
      { id: 'h1', selectedText: 'existing', chapterRef: 'ch1', cfiRange: 'cfi1', color: '#ff0', note: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: 'h2', selectedText: 'imported', chapterRef: 'ch2', cfiRange: 'cfi2', color: '#0f0', note: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);
  });

  it('overwrites existing items with same ID', async () => {
    vi.mocked(importNotesFromMarkdown).mockReturnValue({
      ok: true,
      highlights: [{ id: 'h1', selectedText: 'updated', chapterRef: 'ch1', cfiRange: 'cfi1', color: '#f00', note: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      comments: [],
      bookmarks: [],
      skipped: 0,
      errors: [],
    });

    const { result } = renderHook(() => useImportNotes());
    const file = createFile('# Highlights\n- updated');

    await act(async () => {
      await result.current.handleImportNotes(file);
    });

    expect(mockSetHighlights).toHaveBeenCalledWith([
      { id: 'h1', selectedText: 'updated', chapterRef: 'ch1', cfiRange: 'cfi1', color: '#f00', note: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);
  });

  it('returns error result when import fails', async () => {
    vi.mocked(importNotesFromMarkdown).mockReturnValue({
      ok: false,
      highlights: [],
      comments: [],
      bookmarks: [],
      skipped: 0,
      errors: ['Invalid format'],
    });

    const { result } = renderHook(() => useImportNotes());
    const file = createFile('invalid');

    let importResult: NotesImportResult | undefined;
    await act(async () => {
      importResult = await result.current.handleImportNotes(file);
    });

    expect(importResult).toBeDefined();
    expect(importResult?.ok).toBe(false);
    expect(mockSetHighlights).not.toHaveBeenCalled();
  });

  it('returns ok:false when import has no data and fails', async () => {
    vi.mocked(importNotesFromMarkdown).mockReturnValue({
      ok: false,
      highlights: [],
      comments: [],
      bookmarks: [],
      skipped: 0,
      errors: [],
    });

    const { result } = renderHook(() => useImportNotes());
    const file = createFile('empty');

    let importResult: NotesImportResult | undefined;
    await act(async () => {
      importResult = await result.current.handleImportNotes(file);
    });

    expect(importResult).toBeDefined();
    expect(importResult?.ok).toBe(false);
    expect(mockSetHighlights).not.toHaveBeenCalled();
  });
});

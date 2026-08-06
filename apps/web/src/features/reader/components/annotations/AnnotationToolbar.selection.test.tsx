import { describe, it, expect, vi } from 'vitest';
import { extractSelectionData, clearSelection } from './AnnotationToolbar';

function createMockFrame(
  getSelection: ReturnType<typeof vi.fn>,
  extras?: Partial<HTMLIFrameElement>,
) {
  return { contentWindow: { getSelection }, ...extras } as unknown as HTMLIFrameElement;
}

describe('extractSelectionData', () => {
  it('returns null for collapsed selection', () => {
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: true,
      rangeCount: 0,
    });
    const frame = createMockFrame(mockGetSelection);

    expect(extractSelectionData(frame)).toBeNull();
  });

  it('returns null when no selection', () => {
    const mockGetSelection = vi.fn().mockReturnValue(null);
    const frame = createMockFrame(mockGetSelection);

    expect(extractSelectionData(frame)).toBeNull();
  });

  it('returns null for short text', () => {
    const mockRange = {
      toString: () => 'ab',
      getClientRects: () => [],
      getBoundingClientRect: () => new DOMRect(0, 0, 10, 10),
    };
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => mockRange,
    });
    const frame = createMockFrame(mockGetSelection, {
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    });

    expect(extractSelectionData(frame)).toBeNull();
  });

  it('returns selection data for valid text', () => {
    const mockRange = {
      toString: () => 'Hello World',
      getClientRects: () => [new DOMRect(10, 10, 100, 20)],
      getBoundingClientRect: () => new DOMRect(10, 10, 100, 20),
    };
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => mockRange,
    });
    const frame = createMockFrame(mockGetSelection, {
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    });

    // extractSelectionData is imported at top level
    const result = extractSelectionData(frame);
    expect(result).not.toBeNull();
    expect(result?.text).toBe('Hello World');
  });

  it('extracts cfiRange from range when available', () => {
    const mockRange = {
      toString: () => 'Hello World',
      getClientRects: () => [new DOMRect(10, 10, 100, 20)],
      getBoundingClientRect: () => new DOMRect(10, 10, 100, 20),
      cfiRange: 'epubcfi(/6/4!/2/2)',
    };
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => mockRange,
    });
    const frame = createMockFrame(mockGetSelection, {
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    });

    // extractSelectionData is imported at top level
    const result = extractSelectionData(frame);
    expect(result?.cfiRange).toBe('epubcfi(/6/4!/2/2)');
  });

  it('uses getBoundingClientRect when getClientRects returns empty', () => {
    const mockRange = {
      toString: () => 'Hello World',
      getClientRects: () => [],
      getBoundingClientRect: () => new DOMRect(10, 10, 100, 20),
    };
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => mockRange,
    });
    const frame = createMockFrame(mockGetSelection, {
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    });

    // extractSelectionData is imported at top level
    const result = extractSelectionData(frame);
    expect(result).not.toBeNull();
    expect(result?.rect).toBeDefined();
  });
});

describe('clearSelection', () => {
  it('clears the selection in frame', () => {
    const mockRemoveAllRanges = vi.fn();
    const frame = createMockFrame(
      () => ({ removeAllRanges: mockRemoveAllRanges }),
    );

    // clearSelection is imported at top level
    clearSelection(frame);
    expect(mockRemoveAllRanges).toHaveBeenCalled();
  });

  it('handles null selection gracefully', () => {
    const frame = createMockFrame(() => null);

    // clearSelection is imported at top level
    expect(() => { clearSelection(frame); }).not.toThrow();
  });
});

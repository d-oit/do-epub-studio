import { describe, it, expect, vi } from 'vitest';
import { extractSelectionData, clearSelection } from './AnnotationToolbar';

function buildFrameStub(getSelection: ReturnType<typeof vi.fn>, extras?: Record<string, unknown>) {
  const win = { getSelection };
  return { contentWindow: win, ...extras };
}

describe('extractSelectionData', () => {
  it('returns null for collapsed selection', () => {
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: true,
      rangeCount: 0,
    });
    const frame = buildFrameStub(mockGetSelection) as unknown as HTMLIFrameElement;

    expect(extractSelectionData(frame)).toBeNull();
  });

  it('returns null when no selection', () => {
    const mockGetSelection = vi.fn().mockReturnValue(null);
    const frame = buildFrameStub(mockGetSelection) as unknown as HTMLIFrameElement;

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
    const frame = buildFrameStub(mockGetSelection, {
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    }) as unknown as HTMLIFrameElement;

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
    const frame = buildFrameStub(mockGetSelection, {
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    }) as unknown as HTMLIFrameElement;

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
    const frame = buildFrameStub(mockGetSelection, {
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    }) as unknown as HTMLIFrameElement;

    // extractSelectionData is imported at top level
    const result = extractSelectionData(frame);
    expect(result?.cfiRange).toBe('epubcfi(/6/4!/2/2)');
  });

  it('reports the passage in the reader viewport, not frame-local coordinates', () => {
    const mockRange = {
      toString: () => 'Hello World',
      getClientRects: () => [new DOMRect(10, 20, 100, 20)],
      getBoundingClientRect: () => new DOMRect(10, 20, 100, 20),
    };
    const mockGetSelection = vi.fn().mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      getRangeAt: () => mockRange,
    });
    // The frame is offset inside the reader document; the fixed-position
    // toolbar places itself from these values, so they must include the frame.
    const frame = buildFrameStub(mockGetSelection, {
      getBoundingClientRect: () => new DOMRect(40, 300, 600, 400),
    }) as unknown as HTMLIFrameElement;

    const result = extractSelectionData(frame);

    expect(result?.rect.left).toBe(50);
    expect(result?.rect.top).toBe(320);
  });

  it('captures surrounding text so the passage can be re-anchored', () => {
    const source =
      'The lamplighter walked the harbour wall every evening at dusk, counting the boats as they came home.';
    const passage = 'counting the boats as they came home';
    const textNode = { nodeType: Node.TEXT_NODE, textContent: source };
    const start = source.indexOf(passage);

    const buildFrame = (startOffset: number, endOffset: number) => {
      const mockRange = {
        toString: () => source.slice(startOffset, endOffset),
        getClientRects: () => [new DOMRect(0, 0, 100, 20)],
        getBoundingClientRect: () => new DOMRect(0, 0, 100, 20),
        startContainer: textNode,
        startOffset,
        endContainer: textNode,
        endOffset,
      };
      return buildFrameStub(
        vi.fn().mockReturnValue({ isCollapsed: false, rangeCount: 1, getRangeAt: () => mockRange }),
        { getBoundingClientRect: () => new DOMRect(0, 0, 100, 100) },
      ) as unknown as HTMLIFrameElement;
    };

    // Selection at the end of the text: prefix only, bounded to 32 characters.
    const trailing = extractSelectionData(buildFrame(start, source.length));
    expect(trailing?.suffix).toBeUndefined();
    expect(trailing?.prefix?.length).toBe(32);
    expect(source.endsWith(`${trailing?.prefix}${trailing?.text}`)).toBe(true);

    // Selection at the start: suffix only.
    const leading = extractSelectionData(buildFrame(0, passage.length));
    expect(leading?.prefix).toBeUndefined();
    expect(source.startsWith(`${leading?.text}${leading?.suffix}`)).toBe(true);
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
    const frame = buildFrameStub(mockGetSelection, {
      getBoundingClientRect: () => new DOMRect(0, 0, 100, 100),
    }) as unknown as HTMLIFrameElement;

    // extractSelectionData is imported at top level
    const result = extractSelectionData(frame);
    expect(result).not.toBeNull();
    expect(result?.rect).toBeDefined();
  });
});

describe('clearSelection', () => {
  it('clears the selection in frame', () => {
    const mockRemoveAllRanges = vi.fn();
    const frame = buildFrameStub(
      vi.fn(() => ({ removeAllRanges: mockRemoveAllRanges })),
    ) as unknown as HTMLIFrameElement;

    // clearSelection is imported at top level
    clearSelection(frame);
    expect(mockRemoveAllRanges).toHaveBeenCalled();
  });

  it('handles null selection gracefully', () => {
    const frame = buildFrameStub(vi.fn(() => null)) as unknown as HTMLIFrameElement;

    // clearSelection is imported at top level
    expect(() => {
      clearSelection(frame);
    }).not.toThrow();
  });
});

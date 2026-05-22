export interface SelectionData {
  text: string;
  cfiRange: string;
  chapterRef: string;
  rect: DOMRect;
}

export function extractSelectionData(iframe: HTMLIFrameElement): SelectionData | null {
  const selection = iframe.contentWindow?.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const text = range.toString().trim();

  if (text.length < 3) {
    return null;
  }

  const rects = range.getClientRects();
  const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();

  const iframeRect = iframe.getBoundingClientRect();
  const adjustedRect = new DOMRect(
    rect.left + iframeRect.left,
    rect.top + iframeRect.top,
    rect.width,
    rect.height,
  );

  const chapterRef = window.location.hash.slice(1) || '';

  let cfiRange = '';
  // @ts-expect-error - epub-js adds this property to Range
  if (range.cfiRange) {
    // @ts-expect-error - epub-js adds this property to Range
    cfiRange = range.cfiRange as string;
  }

  return {
    text,
    cfiRange,
    chapterRef,
    rect: adjustedRect,
  };
}

export function clearSelection(iframe: HTMLIFrameElement): void {
  iframe.contentWindow?.getSelection()?.removeAllRanges();
}

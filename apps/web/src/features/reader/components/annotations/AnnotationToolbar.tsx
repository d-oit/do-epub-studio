import { useState, useRef, useEffect, useCallback } from 'react';

type SupportedLocale = 'en' | 'de' | 'fr';

export interface SelectionData {
  text: string;
  cfiRange: string;
  chapterRef: string;
  rect: DOMRect;
}

interface AnnotationToolbarProps {
  selection: SelectionData;
  onHighlight: (color: string) => void;
  onComment: () => void;
  onClose: () => void;
  locale: SupportedLocale;
  canHighlight: boolean;
  canComment: boolean;
}

const HIGHLIGHT_COLORS = [
  { id: 'yellow', hex: '#ffff00' },
  { id: 'green', hex: '#90EE90' },
  { id: 'blue', hex: '#87CEEB' },
  { id: 'pink', hex: '#FFB6C1' },
];

export function AnnotationToolbar({
  selection,
  onHighlight,
  onComment,
  onClose,
  canHighlight,
  canComment,
}: AnnotationToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    const updatePosition = () => {
      const rect = selection.rect;
      const toolbarWidth = 280;
      let left = rect.left + rect.width / 2 - toolbarWidth / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));
      const top = rect.top - 50 + window.scrollY;
      setPosition({ top, left });
    };

    updatePosition();
  }, [selection]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleColorSelect = useCallback(
    (color: string) => {
      onHighlight(color);
      setShowColorPicker(false);
    },
    [onHighlight],
  );

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 flex items-center gap-1 animate-in fade-in slide-in-from-bottom-1 duration-150"
      style={{ top: position.top, left: position.left, minWidth: '200px' }}
    >
      {canHighlight && (
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium transition-colors"
            title="Highlight"
          >
            <span className="inline-block w-4 h-4 rounded bg-yellow-400 mr-1" />
            Highlight
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex gap-1">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => handleColorSelect(color.hex)}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color.hex }}
                  title={color.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {canComment && (
        <button
          onClick={onComment}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium transition-colors"
          title="Comment"
        >
          <svg
            className="w-4 h-4 inline mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Comment
        </button>
      )}
      <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
      <button
        onClick={onClose}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 transition-colors"
        title="Close"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
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
    rect.left - iframeRect.left,
    rect.top - iframeRect.top,
    rect.width,
    rect.height,
  );

  const chapterRef = window.location.hash.slice(1) || '';

  let cfiRange = '';
  if (
    'cfiRange' in range &&
    typeof (range as unknown as { cfiRange?: string }).cfiRange === 'string'
  ) {
    cfiRange = (range as unknown as { cfiRange: string }).cfiRange;
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

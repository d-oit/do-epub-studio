import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { TranslationKeys } from '../../../../i18n/en';
import { Tooltip, IconButton, scaleVariants } from '../../../../components/ui';

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

const HIGHLIGHT_COLORS: Array<{ id: string; hex: string; label: TranslationKeys }> = [
  { id: 'yellow', hex: '#ffff00', label: 'annotation.colors.yellow' },
  { id: 'green', hex: '#90EE90', label: 'annotation.colors.green' },
  { id: 'blue', hex: '#87CEEB', label: 'annotation.colors.blue' },
  { id: 'pink', hex: '#FFB6C1', label: 'annotation.colors.pink' },
];

export function AnnotationToolbar({
  selection,
  onHighlight,
  onComment,
  onClose,
  canHighlight,
  canComment,
}: AnnotationToolbarProps) {
  const { t } = useTranslation();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    const updatePosition = () => {
      const rect = selection.rect;
      const toolbarWidth = 240;
      let left = rect.left + rect.width / 2 - toolbarWidth / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));
      const top = rect.top - 60 + window.scrollY;
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
    <motion.div
      ref={toolbarRef}
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 10 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="fixed z-50 glass-panel rounded-xl shadow-glass-lg border border-border p-1.5 flex items-center gap-1.5"
      style={{ top: position.top, left: position.left, minWidth: '180px' }}
    >
      {canHighlight && (
        <div className="relative flex items-center">
          <Tooltip content={t('annotation.highlight')}>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-background-secondary rounded-lg text-sm font-medium transition-colors"
              aria-label={t('annotation.highlight')}
            >
              <span className="w-4 h-4 rounded-full bg-yellow-400 ring-1 ring-border" />
              <span className="hidden md:inline">{t('annotation.highlight')}</span>
            </button>
          </Tooltip>

          <AnimatePresence>
            {showColorPicker && (
              <motion.div
                initial="initial"
                animate="animate"
                exit="exit"
                variants={scaleVariants}
                className="absolute bottom-full left-0 mb-2 glass-panel rounded-xl shadow-glass border border-border p-2 flex gap-2"
              >
                {HIGHLIGHT_COLORS.map((color) => (
                  <Tooltip key={color.id} content={t(color.label)}>
                    <button
                      onClick={() => handleColorSelect(color.hex)}
                      className="w-8 h-8 rounded-full border-2 border-white/50 hover:scale-110 transition-transform shadow-sm"
                      style={{ backgroundColor: color.hex }}
                      aria-label={t(color.label)}
                    />
                  </Tooltip>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {canComment && (
        <Tooltip content={t('annotation.comment')}>
          <button
            onClick={onComment}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-background-secondary rounded-lg text-sm font-medium transition-colors"
            aria-label={t('annotation.comment')}
          >
            <svg
              className="w-4 h-4 text-accent"
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
            <span className="hidden md:inline">{t('annotation.comment')}</span>
          </button>
        </Tooltip>
      )}

      <div className="h-6 w-px bg-border mx-1" />

      <IconButton
        onClick={onClose}
        variant="ghost"
        size="sm"
        aria-label="Close"
        className="text-foreground-muted hover:text-foreground"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </IconButton>
    </motion.div>
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

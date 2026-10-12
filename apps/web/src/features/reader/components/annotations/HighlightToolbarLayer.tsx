import { useState } from 'react';
import { AnnotationToolbar, type SelectionData } from './AnnotationToolbar';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { SupportedLocale } from '../../../../stores/locale';

interface HighlightToolbarLayerProps {
  selection: SelectionData;
  canHighlight: boolean;
  canComment: boolean;
  locale: SupportedLocale;
  onHighlight: (color: string, selection: SelectionData) => Promise<void>;
  onComment: () => void;
  onFeedback: (kind: 'comment' | 'suggestion') => void;
  onClose: () => void;
}

/**
 * The selection toolbar plus its creation-failure banner (A1/GOAP-311): a
 * rejected highlight must surface the server message instead of becoming an
 * unhandled rejection, and the passage selection must survive the failure so
 * the reader can retry it.
 */
export function HighlightToolbarLayer({
  selection,
  canHighlight,
  canComment,
  locale,
  onHighlight,
  onComment,
  onFeedback,
  onClose,
}: HighlightToolbarLayerProps) {
  const { t } = useTranslation();
  const [highlightError, setHighlightError] = useState<string | null>(null);

  const handleHighlight = (color: string) => {
    void (async () => {
      try {
        setHighlightError(null);
        await onHighlight(color, selection);
        onClose();
      } catch (err) {
        setHighlightError(err instanceof Error ? err.message : t('common.error.generic'));
      }
    })();
  };

  const handleClose = () => {
    setHighlightError(null);
    onClose();
  };

  return (
    <div className="relative">
      <AnnotationToolbar
        selection={selection}
        onHighlight={handleHighlight}
        onComment={onComment}
        onFeedback={onFeedback}
        onClose={handleClose}
        locale={locale}
        canHighlight={canHighlight}
        canComment={canComment}
      />
      {highlightError && (
        <div
          role="alert"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-accent-error text-white text-xs rounded shadow-lg"
        >
          {highlightError}
        </div>
      )}
    </div>
  );
}

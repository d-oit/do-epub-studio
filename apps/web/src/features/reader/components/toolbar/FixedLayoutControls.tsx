import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { scaleVariants, IconButton } from '../../../../components/ui';
import { useFocusTrap } from '@do-epub-studio/ui';
import type { ReaderSpread, ReaderZoom } from '../../../../stores';

interface FixedLayoutControlsProps {
  isOpen: boolean;
  onClose: () => void;
  zoom: ReaderZoom;
  spread: ReaderSpread;
  onSetZoom: (zoom: ReaderZoom) => void;
  onSetSpread: (spread: ReaderSpread) => void;
  t: (key: string) => string;
}

const ZOOM_STEPS: readonly ReaderZoom[] = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const SPREAD_OPTIONS: readonly ReaderSpread[] = ['auto', 'none', 'both'];

export function FixedLayoutControls({
  isOpen,
  onClose,
  zoom,
  spread,
  onSetZoom,
  onSetSpread,
  t,
}: FixedLayoutControlsProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(isOpen, panelRef);

  const handleZoomIn = useCallback(() => {
    const idx = ZOOM_STEPS.indexOf(zoom);
    if (idx >= 0 && idx < ZOOM_STEPS.length - 1) {
      const next = ZOOM_STEPS[idx + 1];
      if (typeof next === 'number') onSetZoom(next);
    }
  }, [zoom, onSetZoom]);

  const handleZoomOut = useCallback(() => {
    const idx = ZOOM_STEPS.indexOf(zoom);
    if (idx > 0) {
      const prev = ZOOM_STEPS[idx - 1];
      if (typeof prev === 'number') onSetZoom(prev);
    }
  }, [zoom, onSetZoom]);

  const handleZoomReset = useCallback(() => {
    onSetZoom(1.0);
  }, [onSetZoom]);

  if (!isOpen) return null;

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fl-controls-title"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={scaleVariants}
      className="fixed top-14 right-4 glass-panel rounded-xl shadow-xl border border-border p-4 z-50 w-72"
    >
      {/* Live region for zoom level announcements — WCAG 4.1.3 */}
      <div
        aria-live="polite"
        role="status"
        className="sr-only"
      >
        {t('reader.fixedLayout.zoom')}: {Math.round(zoom * 100)}%
      </div>
      <div className="flex items-center justify-between mb-4">
        <h2
          id="fl-controls-title"
          className="text-sm font-semibold text-foreground"
        >
          {t('reader.fixedLayout.title')}
        </h2>
        <IconButton
          onClick={onClose}
          variant="ghost"
          size="sm"
          aria-label={t('reader.settings.close')}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </IconButton>
      </div>

      <div className="space-y-4">
        <fieldset>
          <legend
            id="fl-zoom-label"
            className="text-xs font-medium text-foreground-muted block mb-2"
          >
            {t('reader.fixedLayout.zoom')}
          </legend>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom === ZOOM_STEPS[0]}
              className="p-2 rounded-lg border border-border text-foreground hover:bg-background-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent outline-none"
              aria-label={t('reader.fixedLayout.zoomOut')}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="flex-1 px-2 py-2 text-xs font-medium text-foreground bg-background-secondary border border-border rounded-lg hover:bg-background-tertiary transition-colors focus-visible:ring-2 focus-visible:ring-accent outline-none"
              aria-label={t('reader.fixedLayout.zoomReset')}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              className="p-2 rounded-lg border border-border text-foreground hover:bg-background-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent outline-none"
              aria-label={t('reader.fixedLayout.zoomIn')}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                />
              </svg>
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend
            id="fl-spread-label"
            className="text-xs font-medium text-foreground-muted block mb-2"
          >
            {t('reader.fixedLayout.spread')}
          </legend>
          <div className="grid grid-cols-3 gap-1">
            {SPREAD_OPTIONS.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  onSetSpread(mode);
                }}
                aria-pressed={spread === mode}
                className={`
                  px-2 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 outline-none
                  focus-visible:ring-2 focus-visible:ring-accent
                  ${
                    spread === mode
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-foreground hover:bg-background-secondary border border-border'
                  }
                `}
              >
                {t(`reader.fixedLayout.spread.${mode}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </motion.div>
  );
}

import { useMemo } from 'react';
import type { MediaOverlayClip } from '@do-epub-studio/reader-core';
import type { TranslationKeys } from '../../../../i18n';

export interface MediaOverlayBarProps {
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  activeClip: MediaOverlayClip | null;
  error: string | null;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onNextPhrase: () => void;
  onPreviousPhrase: () => void;
  onSetPlaybackRate: (rate: number) => void;
  onClose?: () => void;
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MediaOverlayBar({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  activeClip,
  error,
  onTogglePlay,
  onSeek,
  onNextPhrase,
  onPreviousPhrase,
  onSetPlaybackRate,
  onClose,
  t,
}: MediaOverlayBarProps) {
  const currentRateLabel = `${playbackRate}x`;

  const handleCycleRate = () => {
    const currentIdx = PLAYBACK_RATES.indexOf(playbackRate as (typeof PLAYBACK_RATES)[number]);
    const nextIdx = (currentIdx + 1) % PLAYBACK_RATES.length;
    onSetPlaybackRate(PLAYBACK_RATES[nextIdx] ?? 1);
  };

  const statusAnnouncement = useMemo(() => {
    if (error) return error;
    if (isPlaying) {
      return activeClip?.elementId
        ? t('reader.mediaOverlay.playingElement', { id: activeClip.elementId })
        : t('reader.mediaOverlay.playing');
    }
    return t('reader.mediaOverlay.paused');
  }, [isPlaying, activeClip, error, t]);

  return (
    <section
      aria-label={t('reader.mediaOverlay.title')}
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-surface border-b border-border shadow-xs text-foreground z-20 text-xs sm:text-sm"
    >
      {/* Screen reader status live region */}
      <div className="sr-only" aria-live="polite" role="status">
        {statusAnnouncement}
      </div>

      {/* Left: Play/Pause, Prev, Next controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onPreviousPhrase}
          aria-label={t('reader.mediaOverlay.previousPhrase')}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? t('reader.mediaOverlay.pause') : t('reader.mediaOverlay.play')}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 cursor-pointer transition-colors shadow-xs"
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 4H6v16h4V4zm8 0h-4v16h4V4z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={onNextPhrase}
          aria-label={t('reader.mediaOverlay.nextPhrase')}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Middle: Seek bar and Time display */}
      <div className="flex-1 min-w-48 max-w-xl flex items-center gap-2 sm:gap-3">
        <span className="tabular-nums text-xs text-foreground-muted min-w-10 text-right">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 1}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label={t('reader.mediaOverlay.seek')}
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          aria-valuetext={formatTime(currentTime)}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <span className="tabular-nums text-xs text-foreground-muted min-w-10">
          {formatTime(duration)}
        </span>
      </div>

      {/* Right: Rate selector and optional Close button */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={handleCycleRate}
          aria-label={t('reader.mediaOverlay.playbackRate', { rate: currentRateLabel })}
          className="min-h-11 px-3 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground font-mono font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer transition-colors"
        >
          {currentRateLabel}
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer transition-colors"
          >
            <svg
              className="w-5 h-5"
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
          </button>
        )}
      </div>

      {/* Error notification if audio loading failed */}
      {error && (
        <div
          role="alert"
          className="w-full text-xs text-error font-medium px-2 py-1 rounded-sm bg-error/10 border border-error/20"
        >
          {error}
        </div>
      )}
    </section>
  );
}

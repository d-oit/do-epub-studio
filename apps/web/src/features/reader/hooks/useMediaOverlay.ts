import { useEffect, useRef, useState, useCallback } from 'react';
import type { Rendition, Book } from '@intity/epub-js';
import type {
  MediaOverlayManifest,
  MediaOverlaySequence,
  MediaOverlayClip,
} from '@do-epub-studio/reader-core';
import type * as MediaOverlayModule from '@do-epub-studio/reader-core/media-overlay';

export interface UseMediaOverlayOptions {
  book: Book | null;
  rendition: Rendition | null;
  currentChapter: string | null;
  onError?: (error: string) => void;
}

export interface UseMediaOverlayResult {
  hasMediaOverlays: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  activeClip: MediaOverlayClip | null;
  activeSequence: MediaOverlaySequence | null;
  error: string | null;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  seek: (time: number) => void;
  nextPhrase: () => void;
  previousPhrase: () => void;
  setPlaybackRate: (rate: number) => void;
  stop: () => void;
}

const HIGHLIGHT_CLASS = '-epub-media-overlay-active';
const HIGHLIGHT_STYLE_ID = 'do-media-overlay-highlight-style';

function ensureHighlightStyle(doc: Document): void {
  if (doc.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    .${HIGHLIGHT_CLASS}, .media-overlay-active {
      background-color: rgba(234, 179, 8, 0.35) !important;
      outline: 2px solid rgba(234, 179, 8, 0.75) !important;
      border-radius: 3px !important;
      transition: background-color 0.15s ease-in-out;
    }
  `;
  doc.head?.appendChild(style);
}

function updateElementHighlight(rendition: Rendition | null, elementId: string | undefined): void {
  if (!rendition) return;
  try {
    const contents = rendition.getContents();
    for (const c of contents) {
      const doc = c.document;
      if (!doc) continue;

      const previous = doc.querySelectorAll(`.${HIGHLIGHT_CLASS}, .media-overlay-active`);
      previous.forEach((el) => {
        el.classList.remove(HIGHLIGHT_CLASS, 'media-overlay-active');
      });

      if (elementId) {
        ensureHighlightStyle(doc);
        const target = doc.getElementById(elementId);
        if (target) {
          target.classList.add(HIGHLIGHT_CLASS, 'media-overlay-active');
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  } catch {
    /* ignore DOM errors */
  }
}

function clearAllHighlights(rendition: Rendition | null): void {
  updateElementHighlight(rendition, undefined);
}

export function useMediaOverlay({
  book,
  rendition,
  currentChapter,
  onError,
}: UseMediaOverlayOptions): UseMediaOverlayResult {
  const [manifest, setManifest] = useState<MediaOverlayManifest | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [activeClip, setActiveClip] = useState<MediaOverlayClip | null>(null);
  const [error, setErrorState] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioRevokeRef = useRef<(() => void) | null>(null);
  const loadedAudioSrcRef = useRef<string | null>(null);
  const activeClipRef = useRef<MediaOverlayClip | null>(null);
  activeClipRef.current = activeClip;
  const isMountedRef = useRef(true);
  const mediaOverlayModRef = useRef<typeof MediaOverlayModule | null>(null);

  // Extract manifest whenever book changes
  useEffect(() => {
    let active = true;
    if (!book) {
      setManifest(null);
      return;
    }

    void import('@do-epub-studio/reader-core/media-overlay').then(async (mod) => {
      mediaOverlayModRef.current = mod;
      const m = await mod.extractMediaOverlays(book);
      if (active) {
        setManifest(m);
      }
    });

    return () => {
      active = false;
    };
  }, [book]);

  // Determine active sequence from current chapter or first available sequence
  const activeSequence: MediaOverlaySequence | null = (() => {
    if (!manifest || !manifest.hasMediaOverlays) return null;
    if (currentChapter) {
      const norm = currentChapter.replace(/^\//, '');
      const byFull = manifest.sequencesByChapter[norm];
      if (byFull) return byFull;
      const filename = norm.split('/').pop();
      if (filename && manifest.sequencesByChapter[filename]) {
        return manifest.sequencesByChapter[filename];
      }
    }
    const firstSeq = Object.values(manifest.sequencesByChapter)[0];
    return firstSeq ?? null;
  })();

  const duration = activeSequence?.totalDuration ?? 0;

  // Cleanup audio element and revoke object URLs on teardown
  const teardownAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioRevokeRef.current) {
      audioRevokeRef.current();
      audioRevokeRef.current = null;
    }
    loadedAudioSrcRef.current = null;
    if (isMountedRef.current) {
      setIsPlaying(false);
      setIsPaused(false);
      setActiveClip(null);
    }
    clearAllHighlights(rendition);
  }, [rendition]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      teardownAudio();
    };
  }, [teardownAudio]);

  // Initialize or get audio element
  const getOrCreateAudio = useCallback((): HTMLAudioElement | null => {
    if (typeof Audio === 'undefined') return null;
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const loadAudioForClip = useCallback(
    async (clip: MediaOverlayClip): Promise<boolean> => {
      const audio = getOrCreateAudio();
      if (!audio) return false;

      if (loadedAudioSrcRef.current === clip.audioSrc && audio.src) {
        return true;
      }

      if (audioRevokeRef.current) {
        audioRevokeRef.current();
        audioRevokeRef.current = null;
      }

      const mod =
        mediaOverlayModRef.current ?? (await import('@do-epub-studio/reader-core/media-overlay'));
      mediaOverlayModRef.current = mod;
      const resolved = await mod.resolveAudioClipUrl(book, clip.audioSrc);
      if (!resolved) {
        const msg = `Audio asset not found: ${clip.audioSrc}`;
        setErrorState(msg);
        onError?.(msg);
        return false;
      }

      audio.src = resolved.url;
      audioRevokeRef.current = resolved.revoke;
      loadedAudioSrcRef.current = clip.audioSrc;
      return true;
    },
    [book, getOrCreateAudio, onError],
  );

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const stop = useCallback(() => {
    teardownAudio();
    setCurrentTime(0);
  }, [teardownAudio]);

  const seek = useCallback(
    (time: number) => {
      const bounded = Math.max(0, Math.min(time, duration));
      setCurrentTime(bounded);
      if (audioRef.current) {
        audioRef.current.currentTime = bounded;
      }
      if (activeSequence) {
        const clip =
          mediaOverlayModRef.current?.findActiveClip(activeSequence, bounded) ??
          activeSequence.clips.find((c) => bounded >= c.clipBegin && bounded < c.clipEnd) ??
          null;
        setActiveClip(clip);
        updateElementHighlight(rendition, clip?.elementId);
      }
    },
    [duration, activeSequence, rendition],
  );

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const play = useCallback(async (): Promise<void> => {
    if (!activeSequence || activeSequence.clips.length === 0) return;

    setErrorState(null);
    const audio = getOrCreateAudio();
    if (!audio) {
      setErrorState('Audio playback not supported in this environment');
      return;
    }

    const startClip =
      mediaOverlayModRef.current?.findActiveClip(activeSequence, currentTime) ??
      activeSequence.clips[0];
    if (!startClip) return;

    const loaded = await loadAudioForClip(startClip);
    if (!loaded) return;

    audio.playbackRate = playbackRate;
    if (Math.abs(audio.currentTime - currentTime) > 0.5) {
      audio.currentTime = currentTime >= startClip.clipBegin ? currentTime : startClip.clipBegin;
    }

    // Attach listeners
    audio.ontimeupdate = () => {
      if (!audioRef.current) return;
      const t = audioRef.current.currentTime;
      setCurrentTime(t);

      const matchingClip = mediaOverlayModRef.current?.findActiveClip(activeSequence, t) ?? null;
      if (matchingClip?.id !== activeClipRef.current?.id) {
        setActiveClip(matchingClip);
        updateElementHighlight(rendition, matchingClip?.elementId);
      }

      // Check if current clip ended and another clip uses a different audio asset
      if (matchingClip && matchingClip.audioSrc !== loadedAudioSrcRef.current) {
        void loadAudioForClip(matchingClip).then((ok) => {
          if (ok && audioRef.current) {
            audioRef.current.currentTime = t;
            void audioRef.current.play();
          }
        });
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setActiveClip(null);
      clearAllHighlights(rendition);
    };

    audio.onerror = () => {
      const msg = 'Audio playback error';
      setErrorState(msg);
      onError?.(msg);
      setIsPlaying(false);
    };

    try {
      await audio.play();
      setIsPlaying(true);
      setIsPaused(false);
      setActiveClip(startClip);
      updateElementHighlight(rendition, startClip.elementId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Playback failed';
      setErrorState(msg);
      setIsPlaying(false);
      setIsPaused(true);
    }
  }, [
    activeSequence,
    currentTime,
    getOrCreateAudio,
    loadAudioForClip,
    onError,
    playbackRate,
    rendition,
  ]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, pause, play]);

  const nextPhrase = useCallback(() => {
    if (!activeSequence || activeSequence.clips.length === 0) return;
    const currentIndex = activeClip
      ? activeSequence.clips.findIndex((c) => c.id === activeClip.id)
      : -1;
    const nextIdx = Math.min(activeSequence.clips.length - 1, currentIndex + 1);
    const targetClip = activeSequence.clips[nextIdx];
    if (targetClip) {
      seek(targetClip.clipBegin);
    }
  }, [activeSequence, activeClip, seek]);

  const previousPhrase = useCallback(() => {
    if (!activeSequence || activeSequence.clips.length === 0) return;
    const currentIndex = activeClip
      ? activeSequence.clips.findIndex((c) => c.id === activeClip.id)
      : -1;
    const prevIdx = Math.max(0, currentIndex - 1);
    const targetClip = activeSequence.clips[prevIdx];
    if (targetClip) {
      seek(targetClip.clipBegin);
    }
  }, [activeSequence, activeClip, seek]);

  return {
    hasMediaOverlays: manifest?.hasMediaOverlays ?? false,
    isPlaying,
    isPaused,
    currentTime,
    duration,
    playbackRate,
    activeClip,
    activeSequence,
    error,
    play,
    pause,
    togglePlay,
    seek,
    nextPhrase,
    previousPhrase,
    setPlaybackRate,
    stop,
  };
}

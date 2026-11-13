import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaOverlayBar } from '../MediaOverlayBar';
import { en } from '../../../../../i18n/en';

function mockT(key: string, params?: Record<string, string | number>): string {
  const dict = en as unknown as Record<string, string | Record<string, string>>;
  const val = dict[key];
  let str = typeof val === 'string' ? val : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, String(v)).replace(`{{${k}}}`, String(v));
    }
  }
  return str;
}

describe('MediaOverlayBar', () => {
  const baseProps = {
    isPlaying: false,
    isPaused: false,
    currentTime: 2.5,
    duration: 10,
    playbackRate: 1,
    activeClip: {
      id: 'c1',
      textHref: 'chapter.xhtml#line1',
      elementId: 'line1',
      audioSrc: 'audio.mp3',
      clipBegin: 0,
      clipEnd: 5,
      duration: 5,
    },
    error: null,
    onTogglePlay: vi.fn(),
    onSeek: vi.fn(),
    onNextPhrase: vi.fn(),
    onPreviousPhrase: vi.fn(),
    onSetPlaybackRate: vi.fn(),
    onClose: vi.fn(),
    t: mockT,
  };

  it('renders narration section with accessible controls', () => {
    render(<MediaOverlayBar {...baseProps} />);
    expect(screen.getByRole('region', { name: 'Narration' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play narration' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous phrase' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next phrase' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Seek playback time' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Playback rate: 1x' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('handles play toggle click', () => {
    const onTogglePlay = vi.fn();
    render(<MediaOverlayBar {...baseProps} onTogglePlay={onTogglePlay} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play narration' }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('shows pause button when playing', () => {
    render(<MediaOverlayBar {...baseProps} isPlaying />);
    expect(screen.getByRole('button', { name: 'Pause narration' })).toBeInTheDocument();
  });

  it('triggers next and previous phrase navigation', () => {
    const onNextPhrase = vi.fn();
    const onPreviousPhrase = vi.fn();
    render(
      <MediaOverlayBar
        {...baseProps}
        onNextPhrase={onNextPhrase}
        onPreviousPhrase={onPreviousPhrase}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next phrase' }));
    expect(onNextPhrase).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Previous phrase' }));
    expect(onPreviousPhrase).toHaveBeenCalledTimes(1);
  });

  it('triggers seek slider change', () => {
    const onSeek = vi.fn();
    render(<MediaOverlayBar {...baseProps} onSeek={onSeek} />);
    const slider = screen.getByRole('slider', { name: 'Seek playback time' });
    fireEvent.change(slider, { target: { value: '6.5' } });
    expect(onSeek).toHaveBeenCalledWith(6.5);
  });

  it('cycles playback rate when rate button is clicked', () => {
    const onSetPlaybackRate = vi.fn();
    render(
      <MediaOverlayBar {...baseProps} playbackRate={1} onSetPlaybackRate={onSetPlaybackRate} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Playback rate: 1x' }));
    expect(onSetPlaybackRate).toHaveBeenCalledWith(1.25);
  });

  it('renders error alert when error is present', () => {
    render(<MediaOverlayBar {...baseProps} error="Audio asset not found: silence.mp3" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Audio asset not found: silence.mp3');
  });

  it('announces playing element to screen readers via aria-live', () => {
    render(<MediaOverlayBar {...baseProps} isPlaying />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Playing phrase line1');
  });
});

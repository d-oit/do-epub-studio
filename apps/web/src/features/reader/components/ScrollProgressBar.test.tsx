import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScrollProgressBar } from './ScrollProgressBar';

// GOAP-224 C9: ScrollProgressBar is a purely decorative, CSS-Scroll-Driven
// progress indicator (ADR-105 §4) — it must never be announced to, or
// reachable by, assistive technology. `aria-hidden="true"` + no role/text keeps
// it out of the AT tree; the reader toolbar's chapter progress bar remains the
// accessible progress cue.
describe('ScrollProgressBar', () => {
  it('renders a single decorative element hidden from assistive technology', () => {
    const { container } = render(<ScrollProgressBar />);

    const bar = container.querySelector('.scroll-progress-bar');
    expect(bar).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- verified by expect above
    expect(bar!.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not expose announce-able or interactive content', () => {
    render(<ScrollProgressBar />);

    // No live regions, progress roles, links, buttons, or text to announce.
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(/\S/)).toBeNull();
  });
});

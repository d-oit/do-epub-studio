/**
 * CSS-only scroll-driven reading progress bar.
 *
 * Uses `animation-timeline: scroll()` (CSS Scroll-Driven Animations spec)
 * to show how far the reader has scrolled through the content. Requires
 * no JavaScript state — the browser drives the animation from scroll position.
 *
 * Degrades gracefully: browsers without support show no bar (the toolbar
 * already has a chapter progress indicator as fallback).
 * Respects `prefers-reduced-motion` (bar is hidden).
 *
 * @see ADR-105 §4 (Scroll-Driven Animations)
 * @see Plan 198 S2
 */
export function ScrollProgressBar() {
  return <div className="scroll-progress-bar" aria-hidden="true" />;
}

/**
 * Check if the user prefers reduced motion via the OS accessibility setting.
 *
 * Safe to call outside React render cycle (e.g., in imperative callbacks,
 * epub-js content hooks, or event handlers).
 *
 * @returns `true` when `prefers-reduced-motion: reduce` matches
 */
export function getPrefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

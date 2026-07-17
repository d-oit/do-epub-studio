import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getMatches(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * React hook that tracks the `prefers-reduced-motion` media query.
 * Returns `true` when the user prefers reduced motion.
 */
export function useReducedMotion(): boolean {
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return matches;
}

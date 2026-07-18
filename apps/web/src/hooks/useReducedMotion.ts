import { useCallback, useEffect, useState } from 'react';

import { getPrefersReducedMotion } from '../lib/reduced-motion';

/**
 * React hook that detects the user's `prefers-reduced-motion` OS setting.
 *
 * Listens for changes so the UI reacts in real time when the user
 * toggles the preference. Returns `true` when the user prefers
 * reduced motion.
 *
 * For use outside React render cycles (imperative callbacks, epub-js hooks),
 * use the standalone {@link getPrefersReducedMotion} utility instead.
 *
 * @returns Whether reduced motion is preferred
 *
 * @example
 * ```tsx
 * const prefersReduced = useReducedMotion();
 * const transition = prefersReduced ? 'none' : 'transform 0.18s ease-out';
 * ```
 */
export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';

  const getMatch = useCallback(() => getPrefersReducedMotion(), []);

  const [prefersReduced, setPrefersReduced] = useState(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mql = window.matchMedia(query);

    // Sync in case SSR initial value was stale
    setPrefersReduced(mql.matches);

    // biome-ignore lint/correctness/useQwikValidLexicalScope: React project, not Qwik — false positive
    const handler = (e: MediaQueryListEvent) => { setPrefersReduced(e.matches); };
    mql.addEventListener('change', handler);
    // biome-ignore lint/correctness/useQwikValidLexicalScope: React project, not Qwik — false positive
    return () => { mql.removeEventListener('change', handler); };
  }, []);

  return prefersReduced;
}


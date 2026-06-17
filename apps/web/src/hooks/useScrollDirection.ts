import { useState, useEffect, useRef } from 'react';

/**
 * useScrollDirection — Detects vertical scroll direction (up/down).
 * Optimized with requestAnimationFrame throttling and passive event listeners
 * to ensure 60fps scroll performance.
 */
export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up');
  const lastScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const ticking = useRef(false);
  const directionRef = useRef<'up' | 'down'>('up');
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      const prevScrollY = lastScrollY.current;

      const diff = scrollY - prevScrollY;
      const direction = diff > 0 ? 'down' : 'up';

      // Use a 10px threshold to prevent flickering on micro-scrolls
      if (direction !== directionRef.current && Math.abs(diff) > 10) {
        directionRef.current = direction;
        setScrollDirection(direction);
      }

      lastScrollY.current = scrollY > 0 ? scrollY : 0;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        rafId.current = window.requestAnimationFrame(updateScrollDirection);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
      }
    };
  }, []); // Empty deps: listener is stable

  return scrollDirection;
}

import { useEffect, useRef, useCallback } from 'react';

/**
 * Focus trap hook — traps Tab/Shift+Tab within a container element.
 * Returns a ref to attach to the container and a cleanup function.
 *
 * @param active - Whether the trap is enabled
 * @param containerRef - Ref to the container element
 * @param restoreRef - Ref to the element that should receive focus on deactivate
 */
export function useFocusTrap(
  active: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  restoreRef?: React.RefObject<HTMLElement | null | undefined>,
) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!activeRef.current || !containerRef.current) return;

      if (e.key === 'Tab') {
        const container = containerRef.current;
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

        if (focusable.length === 0) return;

        const firstFocusable = focusable[0];
        const lastFocusable = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    },
    [containerRef],
  );

  useEffect(() => {
    if (active) {
      previousFocus.current = document.activeElement as HTMLElement | null;

      const container = containerRef.current;
      if (container) {
        const firstFocusable = container.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      }

      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Use current value at cleanup time for accurate restore target
      const restoreTarget = restoreRef?.current ?? previousFocus.current;
      if (restoreTarget) {
        restoreTarget.focus();
      }
    };
  }, [active, containerRef, handleKeyDown, restoreRef]);
}

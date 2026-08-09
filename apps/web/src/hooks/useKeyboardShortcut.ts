import { useEffect, useRef } from 'react';

type ModKey = 'ctrl' | 'alt' | 'shift' | 'meta';

interface UseKeyboardShortcutOptions {
  /** Extra modifier keys that must be held. Default: none. */
  mods?: ModKey[];
  /** Only register when true. Defaults to true. */
  enabled?: boolean;
  /** Target element. Defaults to window. */
  target?: EventTarget | null;
}

/**
 * Registers a keyboard shortcut via a single listener per call-site.
 * Multiple components can register the same key independently — each handler
 * is added and removed with the component's lifecycle.
 */
export function useKeyboardShortcut(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: UseKeyboardShortcutOptions = {},
): void {
  const { mods = [], enabled = true, target } = options;

  // Keep handler ref stable so the listener closure always calls the latest handler
  // without needing to re-register the listener on every render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const modsKey = mods.join(',');

  useEffect(() => {
    if (!enabled) return;

    const el: EventTarget = target ?? window;
    const modList = modsKey ? (modsKey.split(',') as ModKey[]) : [];

    const listener = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key !== key) return;
      const modMatch =
        (!modList.includes('ctrl') || ke.ctrlKey) &&
        (!modList.includes('alt') || ke.altKey) &&
        (!modList.includes('shift') || ke.shiftKey) &&
        (!modList.includes('meta') || ke.metaKey);
      if (modMatch) handlerRef.current(ke);
    };

    el.addEventListener('keydown', listener);
    return () => el.removeEventListener('keydown', listener);
  }, [key, enabled, target, modsKey]);
}
